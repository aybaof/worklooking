import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog } from "electron";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { tools } from "./agent/tools";
import { GenerateSystemPrompt } from "./agent/prompt";
import { renderTheme } from "./themes/shared/render"

if (require('electron-squirrel-startup')) app.quit();

// Paths configuration
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let USER_DATA_PATH = app.getPath("userData");
const APP_PATH = app.getAppPath();

// --- Types ---

interface ResumeArgs {
  resumeJson: any;
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

async function writeFile({ filePath, content }: { filePath: string; content: string }) {
  const fullPath = resolveFilePath(filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { success: true, path: fullPath };
}

async function renderResume({ resumeJson }: ResumeArgs) {
  try {
    const targetTheme = "modern-sidebar"; // Default to modern-sidebar
    return renderTheme(targetTheme, resumeJson);
  } catch (error: any) {
    console.error(`Failed to render theme:`, error);
    throw new Error(`Theme rendering failed: ${error.message}`);
  }
}

async function fetchUrl(url: string) {
  const win = new BrowserWindow({ show: false });
  try {
    await win.loadURL(url);
    const content = await win.webContents.executeJavaScript("document.body.innerText");
    return { success: true, content: content.substring(0, 50000) };
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    win.destroy();
  }
}

async function readPdf(filePath: string) {
  const fullPath = resolveFilePath(filePath);
  if (!fs.existsSync(fullPath)) return { error: "File not found" };
  try {
    const parser = new PDFParse({ url: filePath })
    const result = await parser.getText()
    await parser.destroy()
    return { success: true, text: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function generatePdf({ htmlPath, pdfPath }: PdfArgs) {
  const fullHtmlPath = resolveFilePath(htmlPath);
  const fullPdfPath = resolveFilePath(pdfPath);

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
}

function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(USER_DATA_PATH, filePath);
}

// --- IPC Handlers ---

ipcMain.handle("get-user-data-path", () => USER_DATA_PATH);

ipcMain.handle("set-user-data-path", (_event, newPath: string) => {
  if (fs.existsSync(newPath)) {
    USER_DATA_PATH = newPath;
    return { success: true };
  }
  return { success: false, error: "Path does not exist" };
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("select-file", async (_event, { filters }: { filters?: Electron.FileFilter[] } = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("read-file", async (_event, { filePath }: { filePath: string }) => {
  return await readFile({ filePath });
});

ipcMain.handle("write-file", async (_event, { filePath, content }: { filePath: string, content: string }) => {
  return await writeFile({ filePath, content });
});


async function readFile({ filePath }: { filePath: string }) {
  const fullPath = resolveFilePath(filePath);
  if (!fs.existsSync(fullPath)) return { error: "File not found" };
  const content = fs.readFileSync(fullPath, "utf-8");
  return { content };
}

ipcMain.handle("ai-chat", async (_event: IpcMainInvokeEvent, { messages, apiKey, model, resumeJson, configJson }: ChatArgs) => {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    const configSourceJson = configJson || "No config found. Perform initialization.";
    const resumeSourceJson = resumeJson || "No source resume JSON provided.";

    const systemPrompt = GenerateSystemPrompt(configSourceJson, resumeSourceJson);

    let updatedResumeJson: any = null;
    let updatedConfigJson: any = null;

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
        _event.sender.send("chat-update", { content: assistantMessage.content });
      }
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        _event.sender.send("tool-status", { name, status: "start", args });

        let result;
        try {
          if (name === "write_file") {
            result = await writeFile(args);
          } else if (name === "read_file") {
            result = await readFile(args);
          } else if (name === "render_resume") {
            result = await renderResume(args);
          } else if (name === "generate_pdf") {
            result = await generatePdf(args);
          } else if (name === "fetch_url") {
            result = await fetchUrl(args.url);
          } else if (name === "save_source_resume") {
            updatedResumeJson = args.resumeJson;
            result = { success: true, message: "Source resume updated in memory. It will be persisted by the frontend." };
          } else if (name === "save_candidature_config") {
            updatedConfigJson = args.config;
            result = { success: true, message: "Configuration updated in memory. It will be persisted by the frontend." };
          } else if (name === "read_pdf") {
            result = await readPdf(args.filePath);
          }
        } catch (e: any) {
          result = { error: e.message };
        }

        _event.sender.send("tool-status", { name, status: "end", result });

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
      updatedResume: updatedResumeJson,
      updatedConfig: updatedConfigJson
    };
  } catch (error: any) {
    return { error: error.message };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    // In production, __dirname is dist-electron
    // index.html is in dist/index.html (sibling of dist-electron)
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      // Fallback or debug
      console.error("Index file not found at:", indexPath);
      // Try relative to app path
      win.loadFile(path.join(APP_PATH, "dist", "index.html"));
    }
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
