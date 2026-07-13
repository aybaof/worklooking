// Globals injected by Forge's Vite plugin at build time
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

import {
  app,
  BrowserWindow,
  ipcMain,
  IpcMainInvokeEvent,
  dialog,
} from "electron";
import path from "path";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { AiClientRouter } from "./agent/aiClient";
import { ProviderApi } from "../shared/provider-types";
import { GenerateSystemPrompt } from "./agent/prompt";
import { renderTheme } from "./themes/shared/render";
import { themes, ThemeName } from "./themes/index";
import { Channels, ErrorCodes } from "../shared/ipc";
import { Resume } from "../shared/resume-types";
import { CandidatureConfig } from "../shared/candidature-types";
import { updateElectronApp } from "update-electron-app";
import { processImage } from "./utils/image-processor";
import { IPCError, validateAndSanitizePath } from "./lib/paths";
import { detectsAuthRequired } from "./lib/auth-detect";

// Only check for updates in production
if (app.isPackaged) {
  updateElectronApp();
}

if (require("electron-squirrel-startup")) app.quit();

// Paths configuration
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let USER_DATA_PATH = app.getPath("userData");
const APP_PATH = app.getAppPath();
const FETCH_SESSION_PARTITION = "persist:worklooking-fetch";

// --- Types ---

interface ResumeArgs {
  resumeJson: Resume;
  themeName: string;
}

interface PdfArgs {
  htmlPath: string;
  pdfPath: string;
}

interface ChatArgs {
  messages: Array<{ role: string; content: string | null }>;
  apiKey: string;
  model: string;
  baseURL: string;
  api?: ProviderApi;
  resume: Resume;
  candidature: CandidatureConfig;
  selectedTheme?: string;
}

// --- Core Functionality ---

async function writeFile({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}): Promise<{ success: boolean; path: string }> {
  const fullPath = validateAndSanitizePath(filePath, USER_DATA_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { success: true, path: fullPath };
}

async function renderResume({
  resumeJson,
  themeName,
}: ResumeArgs): Promise<string> {
  try {
    const validTheme: ThemeName =
      themeName && themeName in themes
        ? (themeName as ThemeName)
        : "modern-sidebar";
    return renderTheme(validTheme, resumeJson);
  } catch (error: unknown) {
    console.error(`Failed to render theme:`, error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme rendering failed: ${message}`);
  }
}

async function fetchUrl(
  url: string,
  options: { waitForSelector?: string } = {},
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  errorCode?: string;
  needsAuth?: boolean;
  finalUrl?: string;
}> {
  const win = new BrowserWindow({
    show: false, // Always hidden
    width: 1200,
    height: 800,
    opacity: 0, // Ensure completely invisible
    skipTaskbar: true, // Don't show in taskbar
    webPreferences: {
      partition: FETCH_SESSION_PARTITION, // Global persistent session for cookies
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true, // Render offscreen for complete invisibility
    },
  });

  try {
    // Load URL
    await win.loadURL(url);

    // Optional: wait for specific selector (30 second timeout)
    if (options.waitForSelector) {
      try {
        await win.webContents.executeJavaScript(`
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject('Selector timeout'), 30000);
            const check = () => {
              if (document.querySelector('${options.waitForSelector.replace(/'/g, "\\'")}')) {
                clearTimeout(timeout);
                resolve();
              } else {
                setTimeout(check, 100);
              }
            };
            check();
          })
        `);
      } catch (selectorError) {
        // Selector timeout - continue anyway
        console.warn(
          `Selector "${options.waitForSelector}" not found within timeout`,
        );
      }
    }

    // Attempt to automatically handle cookie consent banners
    try {
      await win.webContents.executeJavaScript(`
        (function() {
          // Common cookie consent button patterns (text content, aria-labels, IDs)
          const acceptPatterns = [
            'accept', 'agree', 'allow', 'consent', 'ok', 'got it', 
            'i accept', 'i agree', 'continue', 'understood', 'dismiss'
          ];
          
          // Common reject/decline patterns to avoid
          const rejectPatterns = ['reject', 'decline', 'deny', 'refuse', 'disagree'];
          
          function matchesPattern(text, patterns) {
            const normalized = text.toLowerCase().trim();
            return patterns.some(pattern => normalized.includes(pattern));
          }
          
          function isLikelyAcceptButton(element) {
            const text = element.textContent || element.value || element.ariaLabel || element.title || '';
            const id = element.id || '';
            const className = element.className || '';
            const combined = (text + ' ' + id + ' ' + className).toLowerCase();
            
            // Must match accept pattern
            if (!matchesPattern(combined, acceptPatterns)) return false;
            
            // Must NOT match reject pattern
            if (matchesPattern(combined, rejectPatterns)) return false;
            
            return true;
          }
          
          // Find all clickable elements
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
          
          // Score buttons by likelihood of being the "accept all" button
          const candidates = buttons
            .filter(btn => isLikelyAcceptButton(btn))
            .map(btn => {
              const text = (btn.textContent || '').toLowerCase();
              let score = 0;
              
              // Prefer "accept all" over just "accept"
              if (text.includes('accept all') || text.includes('agree all') || text.includes('allow all')) score += 10;
              else if (text.includes('accept') || text.includes('agree') || text.includes('allow')) score += 5;
              
              // Prefer buttons in likely cookie banner containers
              const parent = btn.closest('[class*="cookie"], [class*="consent"], [class*="gdpr"], [id*="cookie"], [id*="consent"], [id*="gdpr"]');
              if (parent) score += 3;
              
              return { btn, score };
            })
            .sort((a, b) => b.score - a.score);
          
          // Click the best candidate if found
          if (candidates.length > 0) {
            candidates[0].btn.click();
            return true;
          }
          
          return false;
        })();
      `);

      // Wait a moment for the consent to process
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (cookieError) {
      // Cookie banner handling failed - not critical, continue
      console.warn("Cookie consent auto-click failed:", cookieError);
    }

    // Get page title and final URL for auth detection
    const pageTitle = await win.webContents.getTitle();
    const finalUrl = win.webContents.getURL();

    // Conservative auth detection
    const needsAuth = detectsAuthRequired(url, finalUrl, pageTitle);

    if (needsAuth) {
      return {
        success: false,
        needsAuth: true,
        finalUrl,
        error:
          "Authentication required. This URL requires login. Please fetch it from a browser or provide pre-authenticated cookies.",
        errorCode: ErrorCodes.FETCH_NEEDS_AUTH,
      };
    }

    // Extract content
    const content = await win.webContents.executeJavaScript(
      "document.body.innerText",
    );

    return {
      success: true,
      content: content.substring(0, 50000),
      finalUrl,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
      errorCode: ErrorCodes.FETCH_NETWORK_ERROR,
    };
  } finally {
    win.destroy();
  }
}

async function readPdf(
  filePath: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const fullPath = validateAndSanitizePath(filePath, USER_DATA_PATH);
    if (!fs.existsSync(fullPath))
      return { success: false, error: "File not found" };
    const parser = new PDFParse({ url: fullPath });
    const result = await parser.getText();
    await parser.destroy();
    return {
      success: true,
      text: typeof result === "string" ? result : (result as any).text,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

async function generatePdf({
  htmlPath,
  pdfPath,
}: PdfArgs): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const fullHtmlPath = validateAndSanitizePath(htmlPath, USER_DATA_PATH);
    const fullPdfPath = validateAndSanitizePath(pdfPath, USER_DATA_PATH);

    const workerWin = new BrowserWindow({ show: false });
    await workerWin.loadFile(fullHtmlPath);

    const data = await workerWin.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      preferCSSPageSize: true,
      scale: 1.0,
    });

    fs.mkdirSync(path.dirname(fullPdfPath), { recursive: true });
    fs.writeFileSync(fullPdfPath, data);
    await workerWin.close();

    return { success: true, path: fullPdfPath };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

// --- IPC Handlers ---

ipcMain.handle(Channels.APP_GET_USER_DATA_PATH, () => USER_DATA_PATH);

ipcMain.handle(Channels.APP_SET_USER_DATA_PATH, (_event, newPath: string) => {
  try {
    if (!fs.existsSync(newPath)) {
      throw new IPCError(ErrorCodes.INVALID_PATH, "Path does not exist");
    }
    USER_DATA_PATH = newPath;
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: message,
      code: e instanceof IPCError ? e.code : "UNKNOWN_ERROR",
    };
  }
});

ipcMain.handle(Channels.DIALOG_SELECT_FOLDER, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle(
  Channels.DIALOG_SELECT_FILE,
  async (
    _event,
    {
      filters,
    }: { filters?: Array<{ name: string; extensions: string[] }> } = {},
  ) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: filters || [{ name: "All Files", extensions: ["*"] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  },
);

// Image selection and optimization handler
ipcMain.handle(Channels.IMAGE_SELECT_AND_OPTIMIZE, async () => {
  try {
    // Open file dialog for image selection
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
        },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, error: "No file selected" };
    }

    const filePath = result.filePaths[0];

    // Process and optimize the image
    const processResult = await processImage(filePath);

    return processResult;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle(
  Channels.FILE_READ,
  async (_event, { filePath }: { filePath: string }) => {
    try {
      const safePath = validateAndSanitizePath(filePath, USER_DATA_PATH);
      if (!fs.existsSync(safePath)) {
        throw new IPCError(ErrorCodes.FILE_NOT_FOUND, "File not found");
      }
      const content = fs.readFileSync(safePath, "utf-8");
      return { content };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        error: message,
        code: e instanceof IPCError ? e.code : "UNKNOWN_ERROR",
      };
    }
  },
);

ipcMain.handle(
  Channels.FILE_WRITE,
  async (
    _event,
    { filePath, content }: { filePath: string; content: string },
  ) => {
    try {
      const safePath = validateAndSanitizePath(filePath, USER_DATA_PATH);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, content);
      return { success: true, path: safePath };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: message,
        code: e instanceof IPCError ? e.code : ErrorCodes.WRITE_FAILED,
      };
    }
  },
);

ipcMain.handle(
  Channels.RESUME_RENDER_PREVIEW,
  async (
    _event,
    { resumeJson, themeName }: { resumeJson: Resume; themeName: string },
  ) => {
    try {
      const validTheme: ThemeName =
        themeName && themeName in themes
          ? (themeName as ThemeName)
          : "modern-sidebar";
      const html = renderTheme(validTheme, resumeJson);
      return { html };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  },
);

async function readFile({ filePath }: { filePath: string }) {
  try {
    const safePath = validateAndSanitizePath(filePath, USER_DATA_PATH);
    if (!fs.existsSync(safePath)) return { error: "File not found" };
    const content = fs.readFileSync(safePath, "utf-8");
    return { content };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

async function executeTool(
  name: string,
  args: any,
  event: IpcMainInvokeEvent,
  sourceResume?: Resume,
  sourceConfig?: CandidatureConfig,
  selectedTheme?: string,
): Promise<{
  result: unknown;
  updatedResume?: Resume;
  updatedConfig?: CandidatureConfig;
}> {
  let result: unknown;
  let updatedResume: Resume | undefined;
  let updatedConfig: CandidatureConfig | undefined;

  switch (name) {
    case "write_file":
      result = await writeFile(args);
      break;
    case "read_file":
      result = await readFile(args);
      break;
    case "generate_resume_files":
      // Preserve basics from source resume
      if (sourceResume?.basics && args.resumeJson) {
        args.resumeJson.basics = { ...sourceResume.basics };
      }

      try {
        // Step 1: Generate HTML
        const html = await renderResume({
          resumeJson: args.resumeJson,
          themeName: selectedTheme || "modern-sidebar",
        });

        // Step 2: Save HTML to file
        const htmlWriteResult = await writeFile({
          filePath: args.htmlPath,
          content: html,
        });

        if (!htmlWriteResult.success) {
          result = {
            success: false,
            error: "Failed to save HTML file",
          };
          break;
        }

        // Step 3: Generate PDF from HTML file
        let pdfWriteResult:
          | { success: boolean; path?: string; error?: string }
          | undefined;
        let pdfError: string | undefined;

        try {
          pdfWriteResult = await generatePdf({
            htmlPath: args.htmlPath,
            pdfPath: args.pdfPath,
          });

          if (!pdfWriteResult.success) {
            pdfError = pdfWriteResult.error;
          }
        } catch (pdfErr: unknown) {
          const pdfMessage =
            pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          pdfError = pdfMessage;
        }

        // Partial success: HTML saved but PDF failed
        if (pdfError) {
          result = {
            success: true,
            warning: `HTML created but PDF generation failed: ${pdfError}`,
            htmlPath: htmlWriteResult.path,
            htmlSize: html.length,
            pdfPath: null,
            pdfError: pdfError,
          };
        } else {
          // Full success: Both HTML and PDF created
          result = {
            success: true,
            message: "Resume HTML and PDF generated successfully",
            htmlPath: htmlWriteResult.path,
            pdfPath: pdfWriteResult?.path || null,
            htmlSize: html.length,
          };
        }

        // NOTE: `generate_resume_files` is write-only and intentionally does NOT
        // set `updatedResume`. It writes the HTML + PDF to disk and returns its
        // result object. The feedback-modal trigger is the write-free
        // `render_resume_html` tool (the CV-proposal step). This tool is invoked
        // only after the user validates, so file generation cannot re-open the
        // modal.
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          success: false,
          error: `Resume generation failed: ${message}`,
        };
      }
      break;
    case "render_resume_html":
      // Write-free CV *proposal* step. Renders the tailored resume to HTML via
      // the same `renderResume` helper as `generate_resume_files` but WITHOUT
      // writing any file. Setting `updatedResume` (in-memory only) is what opens
      // the feedback modal in the renderer so the user can review + comment
      // before the final `generate_resume_files` write on validation.
      // Preserve basics from the source resume (PII restored at render time,
      // consistent with the PII rule — the model never receives PII).
      if (sourceResume?.basics && args.resumeJson) {
        args.resumeJson.basics = { ...sourceResume.basics };
      }
      try {
        const html = await renderResume({
          resumeJson: args.resumeJson,
          themeName: selectedTheme || "modern-sidebar",
        });
        result = {
          success: true,
          message:
            "Aperçu du CV généré. La proposition est affichée à l'utilisateur pour relecture avant la génération finale.",
          htmlSize: html.length,
        };
        // In-memory only — no file written. This opens the feedback modal.
        updatedResume = args.resumeJson;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          success: false,
          error: `Resume rendering failed: ${message}`,
        };
      }
      break;
    case "fetch_url":
      result = await fetchUrl(args.url, {
        waitForSelector: args.waitForSelector,
      });
      break;
    case "save_source_resume":
      // Preserve only the image from source basics, allow other fields to be updated
      if (sourceResume?.basics?.image && args.resumeJson?.basics) {
        // Keep the original image (base64 data)
        args.resumeJson.basics.image = sourceResume.basics.image;
      }
      // NOTE: `save_source_resume` intentionally does NOT set `updatedResume`.
      // It is only used for the base résumé (never called when tailoring to a job
      // offer), so it must not open the feedback modal. The modal trigger is the
      // write-free `render_resume_html` proposal tool (the CV-proposal step). The
      // image/basics preservation above still applies so the frontend persists the
      // correct data.
      result = {
        success: true,
        message:
          "Source resume updated in memory. It will be persisted by the frontend.",
      };
      break;
    case "save_candidature_config":
      updatedConfig = args.config;
      result = {
        success: true,
        message:
          "Configuration updated in memory. It will be persisted by the frontend.",
      };
      break;
    case "read_pdf":
      result = await readPdf(args.filePath);
      break;
    default:
      result = { error: `Unknown tool: ${name}` };
  }

  return { result, updatedResume, updatedConfig };
}

/**
 * Shared provider chat/tool-loop runner used by BOTH the `ai:chat` handler and
 * the feedback-loop rounds so there is a single implementation (no duplication).
 *
 * `ctx` carries the provider credentials, the resume/candidature/theme used to
 * build the system prompt and execute tools, and the message history to send.
 * `event` is the invoking `IpcMainInvokeEvent` — progress events (`tool:status`
 * / `chat:update`) are sent to `event.sender`, so both the initial tailoring
 * turn and the in-app feedback-loop rounds flow back to the same main window.
 */
async function runChatLoop(
  ctx: {
    messages: Array<{ role: string; content: string | null }>;
    apiKey: string;
    model: string;
    baseURL: string;
    api?: ProviderApi;
    resume: Resume;
    candidature: CandidatureConfig;
    selectedTheme?: string;
  },
  event: IpcMainInvokeEvent,
): Promise<{
  content: string;
  updatedResume: Resume | null;
  updatedConfig: CandidatureConfig | null;
}> {
  const systemPrompt = GenerateSystemPrompt(ctx.candidature, ctx.resume);

  // The router runs the provider agent loop and calls back into this closure
  // for each tool. State (resume/config) is tracked here so the router stays
  // protocol-only.
  let resume = ctx.resume;
  let candidature = ctx.candidature;
  let finalResume: Resume | null = null;
  let finalConfig: CandidatureConfig | null = null;

  const runTool = async (
    name: string,
    toolArgs: Record<string, unknown>,
  ): Promise<unknown> => {
    event.sender.send(Channels.TOOL_STATUS, {
      name,
      status: "start",
      args: toolArgs,
    });

    const { result, updatedResume, updatedConfig } = await executeTool(
      name,
      toolArgs,
      event,
      resume,
      candidature,
      ctx.selectedTheme,
    );

    if (updatedResume) {
      finalResume = updatedResume;
      resume = updatedResume; // Update for next tool calls
    }
    if (updatedConfig) {
      finalConfig = updatedConfig;
      candidature = updatedConfig; // Update for next tool calls
    }

    event.sender.send(Channels.TOOL_STATUS, {
      name,
      status: "end",
      result,
    });

    return result;
  };

  const emitText = (content: string): void => {
    event.sender.send(Channels.CHAT_UPDATE, { content });
  };

  const { content } = await AiClientRouter.getInstance().runChat(ctx.api, {
    apiKey: ctx.apiKey,
    model: ctx.model,
    baseURL: ctx.baseURL,
    systemPrompt,
    messages: ctx.messages,
    runTool,
    emitText,
  });

  return {
    content,
    updatedResume: finalResume,
    updatedConfig: finalConfig,
  };
}

ipcMain.handle(
  Channels.AI_CHAT,
  async (event: IpcMainInvokeEvent, args: ChatArgs) => {
    try {
      const { content, updatedResume, updatedConfig } = await runChatLoop(
        args,
        event,
      );

      return {
        content,
        updatedResume,
        updatedConfig,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  },
);

ipcMain.handle(
  Channels.AI_TEST_CONNECTION,
  async (
    _event: IpcMainInvokeEvent,
    {
      baseURL,
      apiKey,
      model,
      api,
    }: {
      baseURL: string;
      apiKey: string;
      model: string;
      api?: ProviderApi;
    },
  ) => {
    try {
      await AiClientRouter.getInstance().testConnection(api, {
        apiKey,
        model,
        baseURL,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  },
);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Forge's Vite plugin defines these globals based on the renderer name "main_window"
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
