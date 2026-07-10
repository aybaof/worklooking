/**
 * Tier 4 — integration tests for I/O-heavy main-process functions & IPC handlers.
 *
 * `electron/main.ts` registers all of its handlers as top-level side effects and
 * exports nothing, so the strategy is:
 *   - Mock `electron` (app / ipcMain / BrowserWindow / dialog). `ipcMain.handle`
 *     captures each handler by channel into a map we can invoke directly.
 *   - Mock the other top-level side effects (`electron-squirrel-startup`,
 *     `update-electron-app`) and the Forge/Vite globals so importing the module
 *     doesn't crash.
 *   - Point the mocked `app.getPath("userData")` at a real `fs.mkdtemp` temp dir
 *     so FILE_READ / FILE_WRITE / path-sanitization run end-to-end on disk.
 *   - Drive the internal `executeTool` + `readPdf` through the real `AI_CHAT`
 *     handler by mocking `AiClientRouter.getInstance().runChat` to invoke the
 *     `runTool` callback (no new exports needed from main.ts).
 *
 * See tests/TEST_PLAN.md → "Tier 4: main.ts integration".
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { Channels, ErrorCodes } from "../shared/ipc";
import type { Resume } from "../shared/resume-types";
import type { CandidatureConfig } from "../shared/candidature-types";
import type { ChatRunOptions, ChatRunResult } from "./agent/aiClient";

// --- Temp userData dir (created before main.ts is imported) ---
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "worklooking-it-"));

// Captured ipcMain.handle callbacks, keyed by channel.
type Handler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>;
const handlers = new Map<string, Handler>();

// Controls what the mocked AiClientRouter.runChat does with its runTool cb.
let runChatImpl: (options: ChatRunOptions) => Promise<ChatRunResult>;

// --- Mocks (hoisted before imports) ---
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => (name === "userData" ? TMP_ROOT : TMP_ROOT),
    getAppPath: () => TMP_ROOT,
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, cb: Handler) => {
      handlers.set(channel, cb);
    },
  },
  BrowserWindow: class {
    webContents = {
      send: vi.fn(),
      loadURL: vi.fn(),
      getTitle: vi.fn(),
      getURL: vi.fn(),
      executeJavaScript: vi.fn(),
      printToPDF: vi.fn(),
    };
    loadURL = vi.fn();
    loadFile = vi.fn();
    close = vi.fn();
    destroy = vi.fn();
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  IpcMainInvokeEvent: class {},
}));

vi.mock("electron-squirrel-startup", () => ({ default: false }));
vi.mock("update-electron-app", () => ({ updateElectronApp: vi.fn() }));

vi.mock("./agent/aiClient", async () => {
  const actual =
    await vi.importActual<typeof import("./agent/aiClient")>("./agent/aiClient");
  return {
    ...actual,
    AiClientRouter: {
      getInstance: () => ({
        runChat: (_api: unknown, options: ChatRunOptions) =>
          runChatImpl(options),
        testConnection: vi.fn(),
      }),
    },
  };
});

// Forge/Vite-injected globals referenced at module top-level.
vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", undefined);
vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");

/** Minimal fake IpcMainInvokeEvent whose sender records emitted events. */
function makeEvent() {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  return {
    sent,
    event: {
      sender: {
        send: (channel: string, payload: unknown) =>
          sent.push({ channel, payload }),
      },
    } as unknown,
  };
}

/** Invoke a captured IPC handler by channel. */
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler registered for ${channel}`);
  const { event } = makeEvent();
  return handler(event, ...args);
}

const FIXTURES = path.resolve(__dirname, "../tests/fixtures");

const MIN_CANDIDATURE: CandidatureConfig = {
  candidate: {
    name: "Jean Dupont",
    position: "Développeur",
    location: "Paris",
    experience: "5 ans",
    languages: ["Français"],
    skills: [{ category: "Backend", technologies: "Node.js" }],
    strengths: ["Rigueur"],
  },
  goals: {
    salary_target: "50k",
    contract_type: "CDI",
    remote_policy: "hybride",
    criteria: ["stack moderne"],
  },
  target_companies: [],
  applications: [],
};

beforeAll(async () => {
  // Importing registers all handlers via the mocked ipcMain.handle.
  await import("./main");
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  // Default: runChat does nothing (no tool calls) and returns fixed text.
  runChatImpl = async () => ({ content: "done" });
});

describe("FILE_WRITE / FILE_READ handlers (temp dir)", () => {
  it("writes a file then reads the same content back", async () => {
    const rel = "notes/hello.txt";
    const write = (await invoke(Channels.FILE_WRITE, {
      filePath: rel,
      content: "bonjour",
    })) as { success: boolean; path?: string };
    expect(write.success).toBe(true);
    expect(write.path).toBe(path.join(TMP_ROOT, "notes", "hello.txt"));

    const read = (await invoke(Channels.FILE_READ, { filePath: rel })) as {
      content?: string;
      error?: string;
    };
    expect(read.error).toBeUndefined();
    expect(read.content).toBe("bonjour");
  });

  it("creates missing parent directories (mkdir -p)", async () => {
    const rel = "deep/a/b/c/file.txt";
    const write = (await invoke(Channels.FILE_WRITE, {
      filePath: rel,
      content: "x",
    })) as { success: boolean; path?: string };
    expect(write.success).toBe(true);
    expect(fs.existsSync(path.join(TMP_ROOT, "deep", "a", "b", "c"))).toBe(true);
  });

  it("returns FILE_NOT_FOUND code when reading a missing file", async () => {
    const read = (await invoke(Channels.FILE_READ, {
      filePath: "does/not/exist.txt",
    })) as { error?: string; code?: string };
    expect(read.code).toBe(ErrorCodes.FILE_NOT_FOUND);
    expect(read.error).toBe("File not found");
  });

  it("returns INVALID_PATH on relative traversal attempts", async () => {
    const write = (await invoke(Channels.FILE_WRITE, {
      filePath: "../../escape.txt",
      content: "nope",
    })) as { success: boolean; code?: string };
    expect(write.success).toBe(false);
    expect(write.code).toBe(ErrorCodes.INVALID_PATH);
  });
});

describe("RESUME_RENDER_PREVIEW handler", () => {
  const resume: Resume = { basics: { name: "Jean Dupont" } };

  it("returns { html } for a valid theme", async () => {
    const res = (await invoke(Channels.RESUME_RENDER_PREVIEW, {
      resumeJson: resume,
      themeName: "professional",
    })) as { html?: string; error?: string };
    expect(res.error).toBeUndefined();
    expect(typeof res.html).toBe("string");
    expect(res.html).toContain("Jean Dupont");
  });

  it("falls back to 'modern-sidebar' for an invalid theme name", async () => {
    const res = (await invoke(Channels.RESUME_RENDER_PREVIEW, {
      resumeJson: resume,
      themeName: "does-not-exist",
    })) as { html?: string; error?: string };
    expect(res.error).toBeUndefined();
    expect(typeof res.html).toBe("string");
    expect(res.html).toContain("Jean Dupont");
  });
});

describe("APP_SET_USER_DATA_PATH handler", () => {
  it("sets the path when the directory exists", async () => {
    const existing = fs.mkdtempSync(path.join(os.tmpdir(), "worklooking-set-"));
    try {
      const res = (await invoke(Channels.APP_SET_USER_DATA_PATH, existing)) as {
        success: boolean;
      };
      expect(res.success).toBe(true);
      // Confirm it took effect: a subsequent GET returns the new path.
      const got = (await invoke(Channels.APP_GET_USER_DATA_PATH)) as string;
      expect(got).toBe(existing);
    } finally {
      // Restore to the temp root so later tests are unaffected.
      await invoke(Channels.APP_SET_USER_DATA_PATH, TMP_ROOT);
      fs.rmSync(existing, { recursive: true, force: true });
    }
  });

  it("returns an error when the directory does not exist", async () => {
    const missing = path.join(TMP_ROOT, "no-such-dir-xyz");
    const res = (await invoke(Channels.APP_SET_USER_DATA_PATH, missing)) as {
      success: boolean;
      error?: string;
      code?: string;
    };
    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCodes.INVALID_PATH);
  });
});

describe("readPdf (via read_pdf tool through AI_CHAT)", () => {
  it("extracts text from tests/fixtures/sample.pdf", async () => {
    const pdfPath = path.join(FIXTURES, "sample.pdf");
    let toolResult: unknown;

    runChatImpl = async (options) => {
      toolResult = await options.runTool("read_pdf", { filePath: pdfPath });
      return { content: "ok" };
    };

    await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: {},
      candidature: MIN_CANDIDATURE,
    });

    const res = toolResult as { success: boolean; text?: string };
    expect(res.success).toBe(true);
    expect(res.text).toContain("WorkLooking sample PDF fixture");
  });
});

describe("executeTool dispatcher (via AI_CHAT runTool)", () => {
  it("routes 'read_file' to the read handler", async () => {
    // Seed a file to read.
    await invoke(Channels.FILE_WRITE, {
      filePath: "tool/read-me.txt",
      content: "lu par l'outil",
    });

    let toolResult: unknown;
    runChatImpl = async (options) => {
      toolResult = await options.runTool("read_file", {
        filePath: "tool/read-me.txt",
      });
      return { content: "ok" };
    };

    await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: {},
      candidature: MIN_CANDIDATURE,
    });

    expect(toolResult).toEqual({ content: "lu par l'outil" });
  });

  it("preserves resume image on save_source_resume", async () => {
    const sourceResume: Resume = {
      basics: { name: "Original", image: "data:image/png;base64,AAAA" },
    };
    // The tool payload tries to change the name and drop/replace the image.
    const incoming: Resume = {
      basics: { name: "Modifié", image: "data:image/png;base64,ZZZZ" },
    };

    let toolResult: unknown;
    let chatResponse: { updatedResume?: Resume | null } = {};
    runChatImpl = async (options) => {
      toolResult = await options.runTool(
        "save_source_resume",
        { resumeJson: incoming } as unknown as Record<string, unknown>,
      );
      return { content: "ok" };
    };

    chatResponse = (await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: sourceResume,
      candidature: MIN_CANDIDATURE,
    })) as { updatedResume?: Resume | null };

    expect((toolResult as { success: boolean }).success).toBe(true);
    // Image preserved from the source; other fields (name) allowed to change.
    expect(chatResponse.updatedResume?.basics?.image).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(chatResponse.updatedResume?.basics?.name).toBe("Modifié");
  });

  it("returns an error for an unknown tool name", async () => {
    let toolResult: unknown;
    runChatImpl = async (options) => {
      toolResult = await options.runTool("does_not_exist", {});
      return { content: "ok" };
    };

    await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: {},
      candidature: MIN_CANDIDATURE,
    });

    expect(toolResult).toEqual({ error: "Unknown tool: does_not_exist" });
  });
});
