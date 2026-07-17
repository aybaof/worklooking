// Globals injected by Forge's Vite plugin at build time
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

import {
  app,
  BrowserWindow,
  ipcMain,
  IpcMainInvokeEvent,
  dialog,
  shell,
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
import { shouldFallBackToVisible } from "./lib/fetch-fallback";
import { deriveCandidatureFolderSegment } from "./lib/candidature-folder";

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
// How long the hidden fetch attempt gets to settle its initial `loadURL`
// before we treat it as stuck (e.g. a WebAuthn/security-key hang) and fall
// back to a visible window.
const FETCH_HIDDEN_LOAD_TIMEOUT_MS = 10_000;
// How often we poll the visible fallback window for the user having clicked
// "J'ai terminé, continuer".
const FETCH_CONTINUE_POLL_INTERVAL_MS = 500;
// Page-global flag set by the injected banner's button `onclick`. Naturally
// reset on every navigation since it lives on the page's own `window`.
const FETCH_CONTINUE_FLAG = "__worklookingFetchContinueClicked";
// Idempotent banner injected (and re-injected after every navigation) into
// the visible fallback window, inviting the user to log in and signal
// completion. Removes any previously-injected banner before re-inserting so
// repeated navigation events don't stack duplicate banners.
const CONTINUE_BANNER_SCRIPT = `
(function() {
  var existing = document.getElementById('worklooking-fetch-continue-banner');
  if (existing) existing.remove();

  var banner = document.createElement('div');
  banner.id = 'worklooking-fetch-continue-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#1a1a2e;color:#ffffff;padding:12px 16px;font-family:sans-serif;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';

  var message = document.createElement('span');
  message.textContent = "Ce site nécessite une connexion. Connectez-vous puis cliquez sur le bouton ci-dessous pour continuer.";
  message.style.marginRight = '12px';

  var button = document.createElement('button');
  button.id = 'worklooking-fetch-continue-button';
  button.textContent = "J'ai terminé, continuer";
  button.style.cssText = 'background:#4f46e5;color:#ffffff;border:none;border-radius:4px;padding:8px 16px;font-size:14px;cursor:pointer;';
  button.onclick = function() {
    window['${FETCH_CONTINUE_FLAG}'] = true;
  };

  banner.appendChild(message);
  banner.appendChild(button);
  document.documentElement.appendChild(banner);
})();
`;

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

interface FetchUrlResult {
  success: boolean;
  content?: string;
  error?: string;
  errorCode?: string;
  needsAuth?: boolean;
  finalUrl?: string;
}

// Outcome of the hidden-window fetch attempt: either it succeeded outright,
// hit a definite hard error (unchanged existing behavior), or needs to fall
// back to a visible window (new stuck-timeout OR heuristic-auth path).
type HiddenFetchOutcome =
  | { kind: "success"; content: string; finalUrl: string }
  | { kind: "hard-error"; error: string }
  | {
      kind: "fallback";
      timedOut: boolean;
      needsAuth: boolean;
      navigateTo: string;
    };

// Outcome of the visible fallback window: either the user clicked "Continuer"
// (meaning "I've finished authenticating" — fetchUrl must re-run the hidden
// fetch against the original URL, not extract anything from this window), or
// the window was closed without clicking Continue (carries the existing,
// unchanged FETCH_LOGIN_CANCELLED failure result).
type VisibleFallbackOutcome =
  | { kind: "continue-clicked" }
  | { kind: "cancelled"; result: FetchUrlResult };

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

/**
 * Hidden/offscreen fetch attempt: races the initial `loadURL` against a
 * stuck-load timeout, then (if the load settled in time) runs the existing,
 * unchanged `waitForSelector` + cookie-consent-auto-click + auth-detection
 * logic. Returns a discriminated outcome for `fetchUrl` to dispatch on —
 * never opens a visible window itself.
 */
async function attemptHiddenFetch(
  url: string,
  waitForSelector?: string,
): Promise<HiddenFetchOutcome> {
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

  // Best-effort read of wherever the hidden window currently is, falling
  // back to the originally-requested URL if unavailable/blank.
  const safeGetUrl = (): string => {
    try {
      const current = win.webContents.getURL();
      return current && current !== "about:blank" ? current : url;
    } catch {
      return url;
    }
  };

  try {
    // Load URL, racing it against the stuck-load timeout. A late rejection
    // after the timeout wins is expected/harmless — swallow it here so it
    // never surfaces as an unhandled promise rejection.
    const loadPromise = win.loadURL(url);
    loadPromise.catch(() => {});

    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        resolve();
      }, FETCH_HIDDEN_LOAD_TIMEOUT_MS);
    });

    await Promise.race([loadPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!);

    if (timedOut) {
      return {
        kind: "fallback",
        timedOut: true,
        needsAuth: false,
        navigateTo: safeGetUrl(),
      };
    }

    // Optional: wait for specific selector (30 second timeout)
    if (waitForSelector) {
      try {
        await win.webContents.executeJavaScript(`
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject('Selector timeout'), 30000);
            const check = () => {
              if (document.querySelector('${waitForSelector.replace(/'/g, "\\'")}')) {
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
        console.warn(`Selector "${waitForSelector}" not found within timeout`);
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

    if (shouldFallBackToVisible({ hiddenLoadTimedOut: false, needsAuth })) {
      return {
        kind: "fallback",
        timedOut: false,
        needsAuth: true,
        navigateTo: finalUrl || url,
      };
    }

    // Extract content
    const content = await win.webContents.executeJavaScript(
      "document.body.innerText",
    );

    return {
      kind: "success",
      content: content.substring(0, 50000),
      finalUrl,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "hard-error", error: message };
  } finally {
    win.destroy();
  }
}

/**
 * Opens a real, visible `BrowserWindow` on the same persistent fetch session
 * partition so the user can complete an interactive login (and any 2FA/
 * security-key challenge) that the hidden attempt couldn't handle. Injects a
 * French "Continuer" banner, re-injected after every navigation, and polls
 * for the user's click. A click only signals "I've finished authenticating" —
 * it does NOT mean this window's content should be extracted; `fetchUrl` is
 * responsible for re-running the hidden fetch against the original URL
 * afterwards. Resolves `{ kind: "continue-clicked" }` on click, or
 * `{ kind: "cancelled", result }` (the existing, unchanged
 * FETCH_LOGIN_CANCELLED failure) if the window is closed first — never
 * hangs, never leaves an unhandled rejection.
 */
function openVisibleFallbackWindow(
  navigateTo: string,
): Promise<VisibleFallbackOutcome> {
  return new Promise<VisibleFallbackOutcome>((resolve) => {
    const win = new BrowserWindow({
      show: true,
      width: 1200,
      height: 800,
      webPreferences: {
        partition: FETCH_SESSION_PARTITION, // Same session as the hidden attempt
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    let settled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const clearPoll = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const settle = (outcome: VisibleFallbackOutcome) => {
      if (settled) return;
      settled = true;
      clearPoll();
      resolve(outcome);
      if (!win.isDestroyed()) {
        win.destroy();
      }
    };

    const injectBanner = () => {
      win.webContents.executeJavaScript(CONTINUE_BANNER_SCRIPT).catch(() => {
        // Non-fatal: a transient injection failure (e.g. mid-navigation)
        // just means the banner is re-attempted on the next navigation event.
      });
    };

    const startPolling = () => {
      clearPoll();
      pollInterval = setInterval(() => {
        win.webContents
          .executeJavaScript(`window['${FETCH_CONTINUE_FLAG}'] === true`)
          .then((clicked: unknown) => {
            if (settled || clicked !== true) return;
            settle({ kind: "continue-clicked" });
          })
          .catch(() => {
            // Ignore transient executeJavaScript errors (e.g. mid-navigation).
          });
      }, FETCH_CONTINUE_POLL_INTERVAL_MS);
    };

    const onNavigated = () => {
      injectBanner();
      startPolling();
    };

    win.webContents.on("did-finish-load", onNavigated);
    win.webContents.on("did-navigate", onNavigated);
    win.webContents.on("did-navigate-in-page", onNavigated);

    win.once("closed", () => {
      settle({
        kind: "cancelled",
        result: {
          success: false,
          error:
            "The login window was closed before authentication completed.",
          errorCode: ErrorCodes.FETCH_LOGIN_CANCELLED,
        },
      });
    });

    win.loadURL(navigateTo).catch(() => {
      // Non-fatal: a failed initial navigation still leaves a visible,
      // closable window so the cancel path keeps working.
    });
  });
}

/**
 * Fetches the text content of a URL. Tries a hidden/offscreen window first
 * (fast, invisible happy path); if that gets stuck (stuck-load timeout) or
 * lands on what looks like a login page, falls back to a visible window so
 * the user can log in interactively, then resumes automatically once they
 * click "Continuer".
 */
async function fetchUrl(
  url: string,
  options: { waitForSelector?: string } = {},
): Promise<FetchUrlResult> {
  const outcome = await attemptHiddenFetch(url, options.waitForSelector);

  switch (outcome.kind) {
    case "success":
      return {
        success: true,
        content: outcome.content,
        finalUrl: outcome.finalUrl,
      };
    case "hard-error":
      return {
        success: false,
        error: outcome.error,
        errorCode: ErrorCodes.FETCH_NETWORK_ERROR,
      };
    case "fallback": {
      const fallbackOutcome = await openVisibleFallbackWindow(
        outcome.navigateTo,
      );
      if (fallbackOutcome.kind === "cancelled") {
        return fallbackOutcome.result;
      }

      // "continue-clicked": the visible window is already closed. Re-run
      // the hidden attempt against the ORIGINAL url (not outcome.navigateTo,
      // and not whatever the visible window happened to land on), same
      // waitForSelector, same persist:worklooking-fetch session.
      const reFetch = await attemptHiddenFetch(url, options.waitForSelector);
      switch (reFetch.kind) {
        case "success":
          return {
            success: true,
            content: reFetch.content,
            finalUrl: reFetch.finalUrl,
          };
        case "hard-error":
          return {
            success: false,
            error: reFetch.error,
            errorCode: ErrorCodes.FETCH_NETWORK_ERROR,
          };
        case "fallback":
          // Re-fetch itself timed out again, OR detectsAuthRequired flagged
          // it again. One shot only: fail immediately, do NOT call
          // openVisibleFallbackWindow a second time.
          return {
            success: false,
            error:
              "The site still requires authentication after clicking " +
              '"J\'ai terminé, continuer"; please try fetching again once ' +
              "you're fully logged in.",
            errorCode: ErrorCodes.FETCH_LOGIN_INCOMPLETE,
          };
      }
    }
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

// Deterministic Valider write: reached directly from the renderer (no LLM
// round-trip). Derives the destination folder from raw `company`/`position`
// SERVER-SIDE (the sanitizer, not the renderer, performs the derivation —
// AC-6/AC-7), builds the SAME relative `candidatures/<segment>/resume.html` /
// `.../resume.pdf` paths the `generate_resume_files` tool already uses, and
// calls the SAME shared `generateResumeArtifacts` render/write/PII-restore
// helper as that tool (AC-5).
ipcMain.handle(
  Channels.RESUME_GENERATE_FINAL,
  async (
    _event,
    {
      resumeJson,
      company,
      position,
      themeName,
    }: {
      resumeJson: Resume;
      company: string;
      position: string;
      themeName?: string;
    },
  ) => {
    try {
      const segment = deriveCandidatureFolderSegment(company, position);
      const htmlPath = `candidatures/${segment}/resume.html`;
      const pdfPath = `candidatures/${segment}/resume.pdf`;

      // `sourceBasics: resumeJson.basics` is a deliberate, literal no-op
      // restore, not a separate "true source resume" needing new plumbing: by
      // construction, `resumeJson.basics` here already carries the candidate's
      // TRUE PII by the time Valider is clicked — every `render_resume_html`
      // call already restored it from the canonical source resume, and
      // `mergeScopedResume` never lets a regeneration round replace `basics`
      // with anything but the pre-regen value. Passing it through still
      // executes the IDENTICAL `restoreBasicsPii` code path that
      // `generate_resume_files` uses (with the real source `basics`),
      // satisfying AC-5's "reuses the SAME … `restoreBasicsPii` code path".
      const genResult = await generateResumeArtifacts({
        resumeJson,
        sourceBasics: resumeJson.basics,
        htmlPath,
        pdfPath,
        themeName,
      });

      if (!genResult.success) {
        return { success: false, error: genResult.error };
      }

      // Partial success (HTML written, PDF failed): mirror
      // `generate_resume_files`'s shape — success: true, htmlPath set, error
      // populated from the PDF failure.
      return {
        success: true,
        htmlPath: genResult.htmlPath,
        pdfPath: genResult.pdfPath ?? undefined,
        error: genResult.pdfError,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: message,
      };
    }
  },
);

// "Reveal in folder": thin wrapper around Electron's `shell.showItemInFolder`.
// The path passed in is always an absolute path this app itself previously
// returned (from `resume:generate-final`), so this mirrors the existing
// "trusted absolute path" handling `validateAndSanitizePath` already applies
// elsewhere in this file (e.g. `DIALOG_SELECT_FOLDER`/`DIALOG_SELECT_FILE`
// results).
ipcMain.handle(
  Channels.SHELL_SHOW_ITEM_IN_FOLDER,
  async (_event, { path: itemPath }: { path: string }) => {
    try {
      const safePath = validateAndSanitizePath(itemPath, USER_DATA_PATH);
      shell.showItemInFolder(safePath);
      return { success: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
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

type ResumeBasics = NonNullable<Resume["basics"]>;

// The exact set of `basics` fields that `GenerateSystemPrompt`
// (electron/agent/prompt.ts) strips before sending the resume to the model:
// everything in `basics` EXCEPT `summary` and `label`. These are true PII and
// must be restored from the source resume after the model responds. `summary`
// and `label` are deliberately kept in the prompt so the model can tailor them,
// so they are PRESERVED from the model output — never overwritten by the source.
// Keep this list in sync with prompt.ts's `sanitizedResume.basics`.
const BASICS_PII_FIELDS = [
  "name",
  "email",
  "phone",
  "url",
  "image",
  "location",
  "profiles",
] as const satisfies ReadonlyArray<keyof ResumeBasics>;

// Restore only the true PII fields from the source resume onto the model's
// tailored basics, preserving the model-provided `summary` and `label`.
// - If the model omitted `basics`, seed from the source PII (no `summary`/`label`
//   to keep) so PII is never dropped.
// - If the source has no `basics`, leave the model's basics untouched.
function restoreBasicsPii(
  sourceBasics: ResumeBasics | undefined,
  llmBasics: ResumeBasics | undefined,
): ResumeBasics | undefined {
  if (!sourceBasics) return llmBasics;

  const merged: ResumeBasics = { ...(llmBasics ?? {}) };
  for (const field of BASICS_PII_FIELDS) {
    if (field in sourceBasics) {
      // Assign the source PII value, preserving the field's type.
      (merged as Record<string, unknown>)[field] = sourceBasics[field];
    } else {
      // Field absent from source: ensure we don't retain a model-provided PII value.
      delete (merged as Record<string, unknown>)[field];
    }
  }
  return merged;
}

/**
 * Render a resume to HTML, write it, then generate + write the PDF from that
 * HTML file — restoring the true PII fields from `sourceBasics` onto
 * `resumeJson.basics` first (see `restoreBasicsPii`). Shared by the
 * `generate_resume_files` agent tool case AND the deterministic
 * `resume:generate-final` IPC handler so both call sites share exactly one
 * render/write/PII-restore implementation (no duplication/drift).
 *
 * Returns the SAME rich result shape the `generate_resume_files` tool has
 * always returned (`success`, `message`/`warning`/`pdfError`/`htmlPath`/
 * `pdfPath`/`htmlSize`/`error`), unchanged from before this function existed —
 * callers map it to whatever shape they need to return.
 */
async function generateResumeArtifacts({
  resumeJson,
  sourceBasics,
  htmlPath,
  pdfPath,
  themeName,
}: {
  resumeJson: Resume;
  sourceBasics: ResumeBasics | undefined;
  htmlPath: string;
  pdfPath: string;
  themeName?: string;
}): Promise<{
  success: boolean;
  message?: string;
  warning?: string;
  htmlPath?: string;
  pdfPath?: string | null;
  htmlSize?: number;
  error?: string;
  pdfError?: string;
}> {
  // Restore ONLY the true PII fields (name/email/phone/url/image/location/
  // profiles) from the source resume; PRESERVE the model-tailored
  // `summary`/`label` from the proposal so profile/summary feedback takes
  // effect in the final HTML+PDF. See restoreBasicsPii / prompt.ts.
  if (sourceBasics && resumeJson) {
    resumeJson.basics = restoreBasicsPii(sourceBasics, resumeJson.basics);
  }

  try {
    // Step 1: Generate HTML
    const html = await renderResume({
      resumeJson,
      themeName: themeName || "modern-sidebar",
    });

    // Step 2: Save HTML to file
    const htmlWriteResult = await writeFile({
      filePath: htmlPath,
      content: html,
    });

    if (!htmlWriteResult.success) {
      return {
        success: false,
        error: "Failed to save HTML file",
      };
    }

    // Step 3: Generate PDF from HTML file
    let pdfWriteResult:
      | { success: boolean; path?: string; error?: string }
      | undefined;
    let pdfError: string | undefined;

    try {
      pdfWriteResult = await generatePdf({
        htmlPath,
        pdfPath,
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
      return {
        success: true,
        warning: `HTML created but PDF generation failed: ${pdfError}`,
        htmlPath: htmlWriteResult.path,
        htmlSize: html.length,
        pdfPath: null,
        pdfError: pdfError,
      };
    }

    // Full success: Both HTML and PDF created
    return {
      success: true,
      message: "Resume HTML and PDF generated successfully",
      htmlPath: htmlWriteResult.path,
      pdfPath: pdfWriteResult?.path || null,
      htmlSize: html.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Resume generation failed: ${message}`,
    };
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
  company?: string;
  position?: string;
}> {
  let result: unknown;
  let updatedResume: Resume | undefined;
  let updatedConfig: CandidatureConfig | undefined;
  let company: string | undefined;
  let position: string | undefined;

  switch (name) {
    case "write_file":
      result = await writeFile(args);
      break;
    case "read_file":
      result = await readFile(args);
      break;
    case "generate_resume_files":
      // Thin wrapper around the shared render/write/PII-restore helper — output
      // is byte-identical to the previous inline implementation (see
      // `generateResumeArtifacts`). NOTE: `generate_resume_files` is write-only
      // and intentionally does NOT set `updatedResume`. It writes the HTML + PDF
      // to disk and returns its result object. The feedback-modal trigger is the
      // write-free `render_resume_html` tool (the CV-proposal step). This tool
      // is invoked only after the user validates, so file generation cannot
      // re-open the modal.
      result = await generateResumeArtifacts({
        resumeJson: args.resumeJson,
        sourceBasics: sourceResume?.basics,
        htmlPath: args.htmlPath,
        pdfPath: args.pdfPath,
        themeName: selectedTheme,
      });
      break;
    case "render_resume_html":
      // Write-free CV *proposal* step. Renders the tailored resume to HTML via
      // the same `renderResume` helper as `generate_resume_files` but WITHOUT
      // writing any file. Setting `updatedResume` (in-memory only) is what opens
      // the feedback modal in the renderer so the user can review + comment
      // before the final `generate_resume_files` write on validation.
      // Restore ONLY the true PII fields (name/email/phone/url/image/location/
      // profiles) from the source resume; PRESERVE the model-tailored
      // `summary`/`label` from the proposal so a profile/summary comment in the
      // feedback loop is reflected in the preview/proposal. Consistent with the
      // final generate_resume_files step. See restoreBasicsPii / prompt.ts.
      if (sourceResume?.basics && args.resumeJson) {
        args.resumeJson.basics = restoreBasicsPii(
          sourceResume.basics,
          args.resumeJson.basics,
        );
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
        // `company`/`position` are plain, non-PII strings the model already
        // knows from the job-offer context; captured here so they can be
        // threaded back to the renderer (ai:chat response) and ultimately name
        // the candidature folder at Valider time (deterministic write, no LLM
        // involvement). Only captured when non-empty.
        if (typeof args.company === "string" && args.company.trim()) {
          company = args.company;
        }
        if (typeof args.position === "string" && args.position.trim()) {
          position = args.position;
        }
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

  return { result, updatedResume, updatedConfig, company, position };
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
  company?: string;
  position?: string;
}> {
  const systemPrompt = GenerateSystemPrompt(ctx.candidature, ctx.resume);

  // The router runs the provider agent loop and calls back into this closure
  // for each tool. State (resume/config) is tracked here so the router stays
  // protocol-only.
  let resume = ctx.resume;
  let candidature = ctx.candidature;
  let finalResume: Resume | null = null;
  let finalConfig: CandidatureConfig | null = null;
  let finalCompany: string | undefined;
  let finalPosition: string | undefined;

  const runTool = async (
    name: string,
    toolArgs: Record<string, unknown>,
  ): Promise<unknown> => {
    event.sender.send(Channels.TOOL_STATUS, {
      name,
      status: "start",
      args: toolArgs,
    });

    const { result, updatedResume, updatedConfig, company, position } =
      await executeTool(
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
    if (company) {
      finalCompany = company;
    }
    if (position) {
      finalPosition = position;
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
    company: finalCompany,
    position: finalPosition,
  };
}

ipcMain.handle(
  Channels.AI_CHAT,
  async (event: IpcMainInvokeEvent, args: ChatArgs) => {
    try {
      const { content, updatedResume, updatedConfig, company, position } =
        await runChatLoop(args, event);

      return {
        content,
        updatedResume,
        updatedConfig,
        company,
        position,
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
