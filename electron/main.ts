import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog } from "electron";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { tools } from "./agent/tools";
import { GenerateSystemPrompt } from "./agent/prompt";

// Paths configuration
let USER_DATA_PATH = app.getPath("userData");
// In development, app.getAppPath() usually points to the directory containing main.js (or the root if run via electron .)
// Based on the current setup (tsx electron/main.ts), it might be the electron folder.
const APP_PATH = app.getAppPath();
// If APP_PATH is the electron folder, PROJECT_ROOT is one level up.
// We'll check for package.json to be sure.
const PROJECT_ROOT = fs.existsSync(path.join(APP_PATH, "package.json"))
  ? APP_PATH
  : path.join(APP_PATH, "..");

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
}

// --- Core Functionality ---

async function writeFile({ filePath, content }: { filePath: string; content: string }) {
  const fullPath = resolveFilePath(filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { success: true, path: fullPath };
}

async function renderResume({ resumeJson, themeName }: ResumeArgs) {
  // Built-in themes are now in electron/themes
  const themePath = path.join(APP_PATH, "themes", themeName, "index.js");

  if (!fs.existsSync(themePath)) {
    // Fallback to project root themes just in case (optional, but themes are moved to electron/themes)
    const fallbackPath = path.join(PROJECT_ROOT, "themes", themeName, "index.js");
    if (!fs.existsSync(fallbackPath)) {
      throw new Error(`Theme ${themeName} not found at ${themePath}`);
    }
    // If found in fallback, use it
    if (require.cache[require.resolve(fallbackPath)]) {
      delete require.cache[require.resolve(fallbackPath)];
    }
    const theme = require(fallbackPath);
    return theme.render(resumeJson);
  }

  if (require.cache[require.resolve(themePath)]) {
    delete require.cache[require.resolve(themePath)];
  }
  const theme = require(themePath);
  return theme.render(resumeJson);
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

ipcMain.handle("ai-chat", async (_event: IpcMainInvokeEvent, { messages, apiKey, model, resumeJson }: ChatArgs) => {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {

    const configPath = path.join(USER_DATA_PATH, "candidature_config.json");
    const configJson = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, "utf-8")
      : "No config found. Perform initialization.";

    const resumeSourceJson = resumeJson || "No source resume JSON provided.";

    const systemPrompt = GenerateSystemPrompt(configJson, resumeSourceJson);

    let updatedResumeJson: any = null;

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
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

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
          } else if (name === "read_pdf") {
            result = await readPdf(args.filePath);
          }
        } catch (e: any) {
          result = { error: e.message };
        }

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
      updatedResume: updatedResumeJson
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

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
