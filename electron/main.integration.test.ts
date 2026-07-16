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

// Controls what the mocked `BrowserWindow.webContents.printToPDF` does — the
// default resolves a minimal valid PDF buffer so PDF generation SUCCEEDS by
// default (previously any un-mocked call would fail HTML.writeFileSync on
// `undefined` data, silently forcing every test onto the partial-success
// path). Individual tests can override this to force a PDF failure (e.g. the
// partial-success case below). Must be prefixed "mock" so Vitest's hoisting
// of `vi.mock(...)` factories can reference it.
let mockPrintToPDFImpl: (...args: unknown[]) => unknown = () =>
  Buffer.from("%PDF-1.4 fake pdf content for tests");

// Captures `shell.showItemInFolder` calls for the reveal-in-folder handler.
const mockShowItemInFolder = vi.fn();

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
      printToPDF: vi.fn((...args: unknown[]) => mockPrintToPDFImpl(...args)),
    };
    loadURL = vi.fn();
    loadFile = vi.fn();
    close = vi.fn();
    destroy = vi.fn();
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    showItemInFolder: mockShowItemInFolder,
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

/** Recursively list every file path under a directory (sorted, for snapshots). */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
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
}, 30000); // generous timeout: the one-time module import can be slow under
// parallel suite load on CI/dev machines (avoids a flaky 10s hook timeout).

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  // Default: runChat does nothing (no tool calls) and returns fixed text.
  runChatImpl = async () => ({ content: "done" });
  // Default: PDF generation succeeds with a minimal valid buffer.
  mockPrintToPDFImpl = () => Buffer.from("%PDF-1.4 fake pdf content for tests");
  mockShowItemInFolder.mockReset();
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
    // `save_source_resume` preserves the source image in-memory by mutating the
    // incoming payload; other fields (name) are allowed to change.
    expect(incoming.basics?.image).toBe("data:image/png;base64,AAAA");
    expect(incoming.basics?.name).toBe("Modifié");
    // Base-CV save is NOT the feedback-modal trigger and does not persist via the
    // chat: it does NOT return `updatedResume`. Only the write-free
    // `render_resume_html` proposal tool sets `updatedResume`.
    expect(chatResponse.updatedResume).toBeFalsy();
  });

  it("render_resume_html returns updatedResume (in-memory) and writes NO file (AC-1)", async () => {
    const sourceResume: Resume = {
      basics: {
        name: "Jean Source",
        image: "data:image/png;base64,IMG",
        summary: "Résumé source",
        label: "Titre source",
      },
    };
    // Proposed tailored resume the model would pass to render_resume_html.
    // Keep it to `basics` only — the same minimal shape the RESUME_RENDER_PREVIEW
    // test uses — so the theme renders cleanly in the headless test env.
    // The model tries to overwrite PII (name) but tailors summary/label: only PII
    // is restored from source; summary/label are preserved (see restoreBasicsPii).
    const proposed: Resume = {
      basics: {
        name: "Écrasé",
        summary: "Résumé adapté par le modèle",
        label: "Titre adapté par le modèle",
      },
    };

    // Snapshot the temp userData tree so we can assert nothing was written.
    const filesBefore = listFilesRecursive(TMP_ROOT);

    let toolResult: unknown;
    let chatResponse: {
      updatedResume?: Resume | null;
      company?: string;
      position?: string;
    } = {};
    runChatImpl = async (options) => {
      toolResult = await options.runTool("render_resume_html", {
        resumeJson: proposed,
        company: "Doctolib",
        position: "Développeur Fullstack",
      } as unknown as Record<string, unknown>);
      return { content: "voici votre proposition" };
    };

    chatResponse = (await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: sourceResume,
      candidature: MIN_CANDIDATURE,
      selectedTheme: "professional",
    })) as { updatedResume?: Resume | null; company?: string; position?: string };

    // The tool succeeded and reported an HTML size but returned NO html/pdf path
    // (write-free — the renderer previews via resume:render-preview instead).
    const res = toolResult as {
      success: boolean;
      htmlSize?: number;
      htmlPath?: string;
      pdfPath?: string;
    };
    expect(res.success).toBe(true);
    expect(res.htmlSize).toBeGreaterThan(0);
    expect(res.htmlPath).toBeUndefined();
    expect(res.pdfPath).toBeUndefined();

    // company/position captured by executeTool's render_resume_html case flow
    // through runChatLoop → the ai:chat response (AC-2, AC-3).
    expect(chatResponse.company).toBe("Doctolib");
    expect(chatResponse.position).toBe("Développeur Fullstack");

    // The proposal opens the modal: ai:chat returns updatedResume (in-memory).
    // PII fields were restored from the source resume (name/image) at render time.
    expect(chatResponse.updatedResume).toBeTruthy();
    expect(chatResponse.updatedResume?.basics?.image).toBe(
      "data:image/png;base64,IMG",
    );
    expect(chatResponse.updatedResume?.basics?.name).toBe("Jean Source");
    // ...but the model-tailored summary/label are PRESERVED (NOT reverted to
    // source) — this is the scope-addition fix so profile/summary feedback takes
    // effect in the preview/proposal. See restoreBasicsPii.
    expect(chatResponse.updatedResume?.basics?.summary).toBe(
      "Résumé adapté par le modèle",
    );
    expect(chatResponse.updatedResume?.basics?.label).toBe(
      "Titre adapté par le modèle",
    );

    // No file was written anywhere under userData by the render.
    const filesAfter = listFilesRecursive(TMP_ROOT);
    expect(filesAfter).toEqual(filesBefore);
  });

  it("render_resume_html restores PII from source but keeps the LLM summary/label (scope fix)", async () => {
    // Regression test for "commenting on the profile does nothing": the model's
    // tailored summary/label must survive, while all true PII is restored from
    // the source resume. Every PII field differs between source and model here.
    const sourceResume: Resume = {
      basics: {
        name: "Jean Source",
        email: "jean@source.fr",
        phone: "+33 1 00 00 00 00",
        url: "https://source.example",
        image: "data:image/png;base64,SRC",
        location: { city: "Paris", countryCode: "FR" },
        profiles: [
          { network: "LinkedIn", username: "jsource", url: "https://li/jsource" },
        ],
        summary: "Ancien résumé du CV source",
        label: "Ancien titre source",
      },
    };
    // The model rewrote EVERYTHING in basics, including PII, plus a new
    // summary/label from a profile comment.
    const proposed: Resume = {
      basics: {
        name: "Modèle Écrasé",
        email: "modele@llm.fr",
        phone: "+00 000",
        url: "https://llm.example",
        image: "data:image/png;base64,LLM",
        location: { city: "Lyon", countryCode: "US" },
        profiles: [{ network: "X", username: "llm", url: "https://x/llm" }],
        summary: "Nouveau résumé adapté par le modèle",
        label: "Nouveau titre adapté",
      },
    };

    let chatResponse: { updatedResume?: Resume | null } = {};
    runChatImpl = async (options) => {
      await options.runTool("render_resume_html", {
        resumeJson: proposed,
      } as unknown as Record<string, unknown>);
      return { content: "proposition" };
    };

    chatResponse = (await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: sourceResume,
      candidature: MIN_CANDIDATURE,
      selectedTheme: "professional",
    })) as { updatedResume?: Resume | null };

    const basics = chatResponse.updatedResume?.basics;
    expect(basics).toBeTruthy();
    // PII restored verbatim from source (NOT the model's values).
    expect(basics?.name).toBe("Jean Source");
    expect(basics?.email).toBe("jean@source.fr");
    expect(basics?.phone).toBe("+33 1 00 00 00 00");
    expect(basics?.url).toBe("https://source.example");
    expect(basics?.image).toBe("data:image/png;base64,SRC");
    expect(basics?.location).toEqual(sourceResume.basics?.location);
    expect(basics?.profiles).toEqual(sourceResume.basics?.profiles);
    // summary/label PRESERVED from the model (NOT reverted to source).
    expect(basics?.summary).toBe("Nouveau résumé adapté par le modèle");
    expect(basics?.label).toBe("Nouveau titre adapté");
  });

  it("generate_resume_files writes HTML + PDF but does NOT return updatedResume (AC-1)", async () => {
    const sourceResume: Resume = {
      basics: {
        name: "Jean Source",
        email: "jean@source.fr",
        summary: "Résumé source",
        label: "Titre source",
      },
    };
    // The model overwrites PII (name/email) and tailors summary/label. The final
    // write step restores ONLY PII from source and preserves summary/label — the
    // same restore behavior as render_resume_html (restoreBasicsPii).
    const proposed: Resume = {
      basics: {
        name: "X",
        email: "x@modele.fr",
        summary: "Résumé adapté par le modèle",
        label: "Titre adapté par le modèle",
      },
    };

    let toolResult: unknown;
    let chatResponse: { updatedResume?: Resume | null } = {};
    runChatImpl = async (options) => {
      toolResult = await options.runTool("generate_resume_files", {
        resumeJson: proposed,
        htmlPath: "candidatures/gen/resume.html",
        pdfPath: "candidatures/gen/resume.pdf",
      } as unknown as Record<string, unknown>);
      return { content: "fichiers générés" };
    };

    chatResponse = (await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: sourceResume,
      candidature: MIN_CANDIDATURE,
      selectedTheme: "professional",
    })) as { updatedResume?: Resume | null };

    // The tool reports success (HTML at minimum; PDF may or may not succeed in a
    // headless test env — either the full-success or partial-success shape).
    const res = toolResult as {
      success: boolean;
      htmlPath?: string;
      htmlSize?: number;
    };
    expect(res.success).toBe(true);
    // The HTML file was actually written to disk (write-only behavior).
    expect(fs.existsSync(path.join(TMP_ROOT, "candidatures", "gen", "resume.html"))).toBe(
      true,
    );

    // Crucially: it is write-only and must NOT re-open the modal — no
    // updatedResume comes back to the renderer (v5 revert of the v4 trigger).
    expect(chatResponse.updatedResume).toBeFalsy();

    // Restore behavior (consistent with render_resume_html): the tool mutates the
    // proposed payload in place before rendering. ONLY PII (name/email) is
    // restored from the source; the model-tailored summary/label are PRESERVED so
    // profile/summary feedback survives into the final HTML+PDF. See
    // restoreBasicsPii.
    expect(proposed.basics?.name).toBe("Jean Source");
    expect(proposed.basics?.email).toBe("jean@source.fr");
    expect(proposed.basics?.summary).toBe("Résumé adapté par le modèle");
    expect(proposed.basics?.label).toBe("Titre adapté par le modèle");

    // The written HTML reflects the preserved LLM summary/label, not the source.
    const generatedHtml = fs.readFileSync(
      path.join(TMP_ROOT, "candidatures", "gen", "resume.html"),
      "utf8",
    );
    expect(generatedHtml).toContain("Titre adapté par le modèle");
    expect(generatedHtml).not.toContain("Titre source");
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

describe("RESUME_GENERATE_FINAL handler", () => {
  it("success: writes resume.html AND resume.pdf under candidatures/<company>_<position>/ (AC-5, AC-13)", async () => {
    const resumeJson: Resume = {
      basics: { name: "Jean Dupont", summary: "Résumé", label: "Développeur" },
    };

    const res = (await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson,
      company: "Doctolib",
      position: "Développeur Fullstack",
      themeName: "professional",
    })) as {
      success: boolean;
      htmlPath?: string;
      pdfPath?: string;
      error?: string;
    };

    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);

    const expectedHtmlPath = path.join(
      TMP_ROOT,
      "candidatures",
      "doctolib_developpeur-fullstack",
      "resume.html",
    );
    const expectedPdfPath = path.join(
      TMP_ROOT,
      "candidatures",
      "doctolib_developpeur-fullstack",
      "resume.pdf",
    );
    expect(res.htmlPath).toBe(expectedHtmlPath);
    expect(res.pdfPath).toBe(expectedPdfPath);
    expect(fs.existsSync(expectedHtmlPath)).toBe(true);
    expect(fs.existsSync(expectedPdfPath)).toBe(true);
  });

  it("reuses the SAME render/write/PII-restore code path as generate_resume_files (byte-identical HTML) (AC-5)", async () => {
    const sourceResume: Resume = {
      basics: {
        name: "Jean Parity",
        email: "jean@parity.fr",
        summary: "Résumé de parité",
        label: "Label de parité",
      },
    };
    // Both call sites receive an EQUIVALENT resumeJson whose `basics` already
    // matches the source (so restoreBasicsPii is a literal no-op restore on
    // both paths, per the plan's design decision for resume:generate-final).
    const proposedForTool: Resume = { basics: { ...sourceResume.basics } };
    const proposedForFinal: Resume = { basics: { ...sourceResume.basics } };

    // Path 1: existing generate_resume_files tool (via runTool/AI_CHAT).
    runChatImpl = async (options) => {
      await options.runTool("generate_resume_files", {
        resumeJson: proposedForTool,
        htmlPath: "candidatures/parity-tool/resume.html",
        pdfPath: "candidatures/parity-tool/resume.pdf",
      } as unknown as Record<string, unknown>);
      return { content: "ok" };
    };
    await invoke(Channels.AI_CHAT, {
      messages: [],
      apiKey: "k",
      model: "m",
      baseURL: "b",
      resume: sourceResume,
      candidature: MIN_CANDIDATURE,
      selectedTheme: "professional",
    });

    // Path 2: new deterministic resume:generate-final IPC channel.
    await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson: proposedForFinal,
      company: "ParityCo",
      position: "Parity Position",
      themeName: "professional",
    });

    const htmlFromTool = fs.readFileSync(
      path.join(TMP_ROOT, "candidatures", "parity-tool", "resume.html"),
      "utf8",
    );
    const htmlFromFinal = fs.readFileSync(
      path.join(
        TMP_ROOT,
        "candidatures",
        "parityco_parity-position",
        "resume.html",
      ),
      "utf8",
    );
    expect(htmlFromFinal).toBe(htmlFromTool);
  });

  it("partial success: HTML written, PDF failure returns success:true with an error and no pdfPath (AC-5)", async () => {
    mockPrintToPDFImpl = () => {
      throw new Error("PDF engine crashed");
    };

    const res = (await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson: { basics: { name: "X", summary: "S", label: "L" } },
      company: "PartialCo",
      position: "Partial Pos",
    })) as {
      success: boolean;
      htmlPath?: string;
      pdfPath?: string;
      error?: string;
    };

    expect(res.success).toBe(true);
    expect(res.htmlPath).toBeDefined();
    expect(res.pdfPath).toBeUndefined();
    expect(res.error).toContain("PDF engine crashed");

    const folder = path.join(TMP_ROOT, "candidatures", "partialco_partial-pos");
    expect(fs.existsSync(path.join(folder, "resume.html"))).toBe(true);
    expect(fs.existsSync(path.join(folder, "resume.pdf"))).toBe(false);
  });

  it("missing/blank company or position returns success:false and writes no files (defense-in-depth)", async () => {
    const filesBefore = listFilesRecursive(TMP_ROOT);

    const res = (await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson: { basics: { name: "X" } },
      company: "",
      position: "Développeur",
    })) as { success: boolean; error?: string };

    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();

    const filesAfter = listFilesRecursive(TMP_ROOT);
    expect(filesAfter).toEqual(filesBefore);
  });

  it("overwrite, not duplicate: validating twice for the SAME company/position writes the SAME folder with updated content (AC-15)", async () => {
    const company = "OverwriteCo";
    const position = "Overwrite Position";
    const folder = path.join(
      TMP_ROOT,
      "candidatures",
      "overwriteco_overwrite-position",
    );

    await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson: {
        basics: { name: "X", summary: "Premier contenu", label: "L" },
      },
      company,
      position,
    });
    const firstHtml = fs.readFileSync(path.join(folder, "resume.html"), "utf8");
    expect(firstHtml).toContain("Premier contenu");

    await invoke(Channels.RESUME_GENERATE_FINAL, {
      resumeJson: {
        basics: { name: "X", summary: "Second contenu", label: "L" },
      },
      company,
      position,
    });
    const secondHtml = fs.readFileSync(
      path.join(folder, "resume.html"),
      "utf8",
    );
    expect(secondHtml).toContain("Second contenu");
    expect(secondHtml).not.toContain("Premier contenu");

    // Only ONE candidature folder for this company/position — no duplicate.
    const candidaturesDir = path.join(TMP_ROOT, "candidatures");
    const siblingDirs = fs
      .readdirSync(candidaturesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("overwriteco"))
      .map((e) => e.name);
    expect(siblingDirs).toEqual(["overwriteco_overwrite-position"]);
  });
});

describe("SHELL_SHOW_ITEM_IN_FOLDER handler", () => {
  it("calls shell.showItemInFolder with the sanitized path", async () => {
    const target = path.join(
      TMP_ROOT,
      "candidatures",
      "doctolib_dev",
      "resume.pdf",
    );

    const res = (await invoke(Channels.SHELL_SHOW_ITEM_IN_FOLDER, {
      path: target,
    })) as { success: boolean; error?: string };

    expect(res.success).toBe(true);
    expect(mockShowItemInFolder).toHaveBeenCalledWith(target);
  });

  it("returns an error response for an invalid/empty path", async () => {
    const res = (await invoke(Channels.SHELL_SHOW_ITEM_IN_FOLDER, {
      path: "",
    })) as { success: boolean; error?: string };

    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
