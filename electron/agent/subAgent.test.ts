/**
 * Tier 2 — `runSubAgent()` contract (electron/agent/subAgent.ts).
 *
 * `AiClientRouter.getInstance().runChat` is mocked so these tests exercise
 * `runSubAgent()`'s own contract in isolation (allowed-tools guard, no
 * emitText forwarding, never-throw behavior, provider-agnostic delegation)
 * without depending on the real OpenAI/Anthropic SDKs.
 *
 * Code-inspection note backing AC-9 ("no duplicated branching"): subAgent.ts
 * has no `import ... from "openai"` / `"@anthropic-ai/sdk"` — it only calls
 * `AiClientRouter.getInstance().runChat`, so both OpenAI- and Anthropic-style
 * `api` values are handled identically here (same mocked call, no branch).
 *
 * See tests/TEST_PLAN.md → "Tier 2: subAgent.ts".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRunOptions, ChatRunResult } from "./aiClient";

const runChatMock =
  vi.fn<(api: unknown, options: ChatRunOptions) => Promise<ChatRunResult>>();

vi.mock("./aiClient", async () => {
  const actual = await vi.importActual<typeof import("./aiClient")>("./aiClient");
  return {
    ...actual,
    AiClientRouter: {
      getInstance: () => ({
        runChat: runChatMock,
      }),
    },
  };
});

import { runSubAgent, SUB_AGENT_MAX_ROUNDS } from "./subAgent";

function baseOptions(overrides: Partial<Parameters<typeof runSubAgent>[0]> = {}) {
  return {
    apiKey: "key",
    model: "model",
    baseURL: "https://example.com",
    systemPrompt: "Tu es un sous-agent de test.",
    userInput: "Analyse ceci.",
    allowedTools: ["read_pdf"],
    runTool: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

describe("runSubAgent", () => {
  beforeEach(() => {
    runChatMock.mockReset();
  });

  it("returns { success: true, content } when the provider produces a final answer within the cap (AC-8)", async () => {
    runChatMock.mockResolvedValue({ content: '{"ok":true}' });
    const result = await runSubAgent(baseOptions());
    expect(result).toEqual({ success: true, content: '{"ok":true}' });
  });

  it("passes maxRounds = SUB_AGENT_MAX_ROUNDS (5) to the underlying runChat", async () => {
    runChatMock.mockResolvedValue({ content: "done" });
    await runSubAgent(baseOptions());
    expect(runChatMock.mock.calls[0][1].maxRounds).toBe(SUB_AGENT_MAX_ROUNDS);
    expect(SUB_AGENT_MAX_ROUNDS).toBe(5);
  });

  it("returns { success: false, error } without throwing when cappedOut is true (AC-7)", async () => {
    runChatMock.mockResolvedValue({ content: "", cappedOut: true });
    const result = await runSubAgent(baseOptions());
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("never throws on a hard provider/network error, returns structured failure instead", async () => {
    runChatMock.mockRejectedValue(new Error("network down"));
    const result = await runSubAgent(baseOptions());
    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("filters toolDefs down to only the entries in allowedTools", async () => {
    runChatMock.mockResolvedValue({ content: "done" });
    await runSubAgent(baseOptions({ allowedTools: ["fetch_url", "read_pdf"] }));
    const toolDefs = runChatMock.mock.calls[0][1].toolDefs ?? [];
    const names = toolDefs.map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names.sort()).toEqual(["fetch_url", "read_pdf"]);
  });

  it("builds messages from userInput only (no main conversation history)", async () => {
    runChatMock.mockResolvedValue({ content: "done" });
    await runSubAgent(baseOptions({ userInput: "mon offre ici" }));
    expect(runChatMock.mock.calls[0][1].messages).toEqual([
      { role: "user", content: "mon offre ici" },
    ]);
  });

  it("passes a no-op emitText (AC-10)", async () => {
    runChatMock.mockImplementation(async (_api, options) => {
      // Simulate the provider streaming intermediate text — must not throw
      // or have any observable side effect.
      expect(() => options.emitText("partial text")).not.toThrow();
      return { content: "done" };
    });
    await runSubAgent(baseOptions());
    expect(runChatMock).toHaveBeenCalled();
  });

  it("rejects a disallowed tool name via the guard closure without invoking the real runTool (AC-15)", async () => {
    const realRunTool = vi.fn(async () => ({ success: true }));
    runChatMock.mockImplementation(async (_api, options) => {
      const result = (await options.runTool("write_file", {})) as {
        success: boolean;
        error?: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      return { content: "done" };
    });
    await runSubAgent(baseOptions({ allowedTools: ["read_pdf"], runTool: realRunTool }));
    expect(realRunTool).not.toHaveBeenCalled();
  });

  it("works identically whether api is 'openai' or 'anthropic' (AC-9, provider-agnostic)", async () => {
    runChatMock.mockResolvedValue({ content: "ok" });
    const openaiResult = await runSubAgent(baseOptions({ api: "openai" }));
    const anthropicResult = await runSubAgent(baseOptions({ api: "anthropic" }));
    expect(openaiResult).toEqual({ success: true, content: "ok" });
    expect(anthropicResult).toEqual({ success: true, content: "ok" });
  });
});
