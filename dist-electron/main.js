"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const openai_1 = __importDefault(require("openai"));
// Paths configuration
const USER_DATA_PATH = electron_1.app.getPath("userData");
const APP_PATH = electron_1.app.getAppPath();
// --- Core Functionality ---
async function writeFile({ filePath, content }) {
    const fullPath = resolveFilePath(filePath);
    fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
    fs_1.default.writeFileSync(fullPath, content);
    return { success: true, path: fullPath };
}
async function renderResume({ resumeJson, themeName }) {
    const themePath = path_1.default.join(APP_PATH, "themes", themeName, "index.js");
    if (!fs_1.default.existsSync(themePath))
        throw new Error(`Theme ${themeName} not found at ${themePath}`);
    if (require.cache[require.resolve(themePath)]) {
        delete require.cache[require.resolve(themePath)];
    }
    const theme = require(themePath);
    return theme.render(resumeJson);
}
async function generatePdf({ htmlPath, pdfPath }) {
    const fullHtmlPath = resolveFilePath(htmlPath);
    const fullPdfPath = resolveFilePath(pdfPath);
    const workerWin = new electron_1.BrowserWindow({ show: false });
    await workerWin.loadFile(fullHtmlPath);
    const data = await workerWin.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        scale: 1.0,
    });
    fs_1.default.mkdirSync(path_1.default.dirname(fullPdfPath), { recursive: true });
    fs_1.default.writeFileSync(fullPdfPath, data);
    await workerWin.close();
    return { success: true, path: fullPdfPath };
}
function resolveFilePath(filePath, isSystem = false) {
    if (path_1.default.isAbsolute(filePath))
        return filePath;
    const root = isSystem ? APP_PATH : USER_DATA_PATH;
    return path_1.default.join(root, filePath);
}
// --- IPC Handlers ---
electron_1.ipcMain.handle("get-user-data-path", () => USER_DATA_PATH);
electron_1.ipcMain.handle("ai-chat", async (_event, { messages, apiKey, model }) => {
    const client = new openai_1.default({
        apiKey: apiKey,
        baseURL: "https://zen.opencode.ai/zen/v1",
    });
    try {
        const agentMd = fs_1.default.existsSync(path_1.default.join(APP_PATH, "agent.md"))
            ? fs_1.default.readFileSync(path_1.default.join(APP_PATH, "agent.md"), "utf-8")
            : "No instructions found.";
        const configPath = path_1.default.join(USER_DATA_PATH, "candidature_config.json");
        const configJson = fs_1.default.existsSync(configPath)
            ? fs_1.default.readFileSync(configPath, "utf-8")
            : "No config found. Perform initialization.";
        const systemPrompt = `
      You are an expert recruitment assistant. 
      Context from agent.md: ${agentMd}
      Current config: ${configJson}
      
      Rules:
      - Be concise and professional.
      - Use the provided tools for filesystem actions.
      - Important: All files (resumes, candidatures) MUST be saved in the user data directory.
    `;
        const tools = [
            {
                type: "function",
                function: {
                    name: "write_file",
                    description: "Crée ou met à jour un fichier dans le dossier utilisateur.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "Chemin relatif (ex: candidatures/offre.md)",
                            },
                            content: { type: "string" },
                        },
                        required: ["filePath", "content"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "render_resume",
                    description: "Génère le HTML d'un CV à partir du JSON et d'un thème.",
                    parameters: {
                        type: "object",
                        properties: {
                            resumeJson: {
                                type: "object",
                                description: "Le contenu du CV au format JSON Resume.",
                            },
                            themeName: {
                                type: "string",
                                description: "Le nom du thème (ex: modern-sidebar).",
                            },
                        },
                        required: ["resumeJson", "themeName"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "generate_pdf",
                    description: "Génère un PDF à partir d'un fichier HTML.",
                    parameters: {
                        type: "object",
                        properties: {
                            htmlPath: {
                                type: "string",
                                description: "Chemin relatif vers le HTML source.",
                            },
                            pdfPath: {
                                type: "string",
                                description: "Chemin relatif vers le PDF de sortie.",
                            },
                        },
                        required: ["htmlPath", "pdfPath"],
                    },
                },
            },
        ];
        let currentMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
        ];
        let response = await client.chat.completions.create({
            model: model,
            messages: currentMessages,
            tools: tools,
        });
        let assistantMessage = response.choices[0].message;
        while (assistantMessage.tool_calls) {
            currentMessages.push(assistantMessage);
            for (const toolCall of assistantMessage.tool_calls) {
                if (toolCall.type !== "function")
                    continue;
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let result;
                try {
                    if (name === "write_file") {
                        result = await writeFile(args);
                    }
                    else if (name === "render_resume") {
                        result = await renderResume(args);
                    }
                    else if (name === "generate_pdf") {
                        result = await generatePdf(args);
                    }
                }
                catch (e) {
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
            });
            assistantMessage = response.choices[0].message;
        }
        return { content: assistantMessage.content };
    }
    catch (error) {
        return { error: error.message };
    }
});
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173");
    }
    else {
        win.loadFile(path_1.default.join(__dirname, "../dist/index.html"));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
//# sourceMappingURL=main.js.map