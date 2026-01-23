import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog, session } from "electron";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { tools } from "./agent/tools";
import { GenerateSystemPrompt } from "./agent/prompt";
import { renderTheme } from "./themes/shared/render"
import { Channels, ErrorCodes } from "../shared/ipc";
import { Resume } from "../shared/resume-types";
import { CandidatureConfig } from "../shared/candidature-types";


if (require('electron-squirrel-startup')) app.quit();

class IPCError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'IPCError';
  }
}

function validateAndSanitizePath(filePath: string, basePath: string): string {
  if (!filePath) {
    throw new IPCError(ErrorCodes.INVALID_PATH, 'Path is required');
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(basePath, filePath);

  const normalizedPath = path.normalize(resolvedPath);

  // Prevent directory traversal
  if (!normalizedPath.startsWith(basePath) && !path.isAbsolute(filePath)) {
    throw new IPCError(ErrorCodes.INVALID_PATH, 'Path traversal not allowed');
  }

  return normalizedPath;
}

// Paths configuration
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let USER_DATA_PATH = app.getPath("userData");
const APP_PATH = app.getAppPath();

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
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  apiKey: string;
  model: string;
  resumeJson?: string;
  configJson?: string;
}

// --- Core Functionality ---

async function writeFile({ filePath, content }: { filePath: string; content: string }): Promise<{ success: boolean; path: string }> {
  const fullPath = validateAndSanitizePath(filePath, USER_DATA_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { success: true, path: fullPath };
}

async function renderResume({ resumeJson }: ResumeArgs): Promise<string> {
  try {
    const targetTheme = "modern-sidebar"; // Default to modern-sidebar
    return renderTheme(targetTheme, resumeJson);
  } catch (error: unknown) {
    console.error(`Failed to render theme:`, error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme rendering failed: ${message}`);
  }
}

async function fetchUrl(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  const win = new BrowserWindow({ show: false });
  try {
    await win.loadURL(url);
    const content = await win.webContents.executeJavaScript("document.body.innerText");
    return { success: true, content: content.substring(0, 50000) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    win.destroy();
  }
}

async function readPdf(filePath: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const fullPath = validateAndSanitizePath(filePath, USER_DATA_PATH);
    if (!fs.existsSync(fullPath)) return { success: false, error: "File not found" };
    const parser = new PDFParse({ url: fullPath })
    const result = await parser.getText()
    await parser.destroy()
    return { success: true, text: typeof result === 'string' ? result : (result as any).text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

async function generatePdf({ htmlPath, pdfPath }: PdfArgs): Promise<{ success: boolean; path?: string; error?: string }> {
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
        right: 0
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
      code: e instanceof IPCError ? e.code : 'UNKNOWN_ERROR'
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

ipcMain.handle(Channels.DIALOG_SELECT_FILE, async (_event, { filters }: { filters?: Array<{ name: string; extensions: string[] }> } = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle(Channels.FILE_READ, async (_event, { filePath }: { filePath: string }) => {
  try {
    const safePath = validateAndSanitizePath(filePath, USER_DATA_PATH);
    if (!fs.existsSync(safePath)) {
      throw new IPCError(ErrorCodes.FILE_NOT_FOUND, 'File not found');
    }
    const content = fs.readFileSync(safePath, "utf-8");
    return { content };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      error: message,
      code: e instanceof IPCError ? e.code : 'UNKNOWN_ERROR'
    };
  }
});

ipcMain.handle(Channels.FILE_WRITE, async (_event, { filePath, content }: { filePath: string, content: string }) => {
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
      code: e instanceof IPCError ? e.code : ErrorCodes.WRITE_FAILED
    };
  }
});


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
  event: IpcMainInvokeEvent
): Promise<{ result: unknown; updatedResume?: Resume; updatedConfig?: CandidatureConfig }> {
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
    case "render_resume":
      result = await renderResume(args);
      break;
    case "generate_pdf":
      result = await generatePdf(args);
      break;
    case "fetch_url":
      result = await fetchUrl(args.url);
      break;
    case "save_source_resume":
      updatedResume = args.resumeJson;
      result = { success: true, message: "Source resume updated in memory. It will be persisted by the frontend." };
      break;
    case "save_candidature_config":
      updatedConfig = args.config;
      result = { success: true, message: "Configuration updated in memory. It will be persisted by the frontend." };
      break;
    case "read_pdf":
      result = await readPdf(args.filePath);
      break;
    default:
      result = { error: `Unknown tool: ${name}` };
  }

  return { result, updatedResume, updatedConfig };
}

ipcMain.handle(Channels.AI_CHAT, async (_event: IpcMainInvokeEvent, { messages, apiKey, model, resumeJson, configJson }: ChatArgs) => {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    const configSourceJson = configJson || "No config found. Perform initialization.";
    const resumeSourceJson = resumeJson || "No source resume JSON provided.";

    const systemPrompt = GenerateSystemPrompt(configSourceJson, resumeSourceJson);

    let finalResume: Resume | null = null;
    let finalConfig: CandidatureConfig | null = null;

    let currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    let response = await client.chat.completions.create({
      model: model,
      messages: currentMessages,
      tools: tools,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No response from AI agent");
    }

    let assistantMessage = response.choices[0].message;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      if (assistantMessage.content) {
        _event.sender.send(Channels.CHAT_UPDATE, { content: assistantMessage.content });
      }
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        _event.sender.send(Channels.TOOL_STATUS, { name, status: "start", args });

        const { result, updatedResume, updatedConfig } = await executeTool(name, args, _event);

        if (updatedResume) finalResume = updatedResume;
        if (updatedConfig) finalConfig = updatedConfig;

        _event.sender.send(Channels.TOOL_STATUS, { name, status: "end", result });

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      response = await client.chat.completions.create({
        model: model,
        messages: currentMessages,
        tools: tools,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from AI agent during tool execution");
      }
      assistantMessage = response.choices[0].message;
    }

    return {
      content: assistantMessage.content || "No content returned",
      updatedResume: finalResume,
      updatedConfig: finalConfig
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    return;
  }

  // In production, __dirname is dist-electron
  // index.html is in dist/index.html (sibling of dist-electron)
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    win.loadFile(indexPath);
    return;
  }

  // Fallback or debug
  console.error("Index file not found at:", indexPath);
  // Try relative to app path
  win.loadFile(path.join(APP_PATH, "dist", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
