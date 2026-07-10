/**
 * Tier 1 + 2 — provider router / adapters in electron/agent/aiClient.ts
 *
 * `normalizeAnthropicBaseURL` is already exported. `isAzureEndpoint` is NOT
 * exported — export it (or test indirectly). `AnthropicProvider`,
 * `OpenAIProvider` and `AiClientRouter` may need light exposure for testing.
 * Update docs/agent.md if the public surface changes.
 *
 * See tests/TEST_PLAN.md → "Tier 1/2: aiClient.ts".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeAnthropicBaseURL,
  isAzureEndpoint,
  AiClientRouter,
  toAnthropicTools,
} from "./aiClient";
import { tools } from "./tools";
import type { ChatRunOptions } from "./aiClient";

// --- SDK mocks (hoisted) -------------------------------------------------
// The OpenAI + Anthropic clients are constructed inside the provider
// adapters; we mock the constructors so runChat exercises the real tool-call
// loop against scripted responses.

const openaiCreate = vi.fn();
const openaiCtor = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
    constructor(opts: unknown) {
      openaiCtor(opts);
    }
  },
}));

const anthropicCreate = vi.fn();
const anthropicCtor = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
    constructor(opts: unknown) {
      anthropicCtor(opts);
    }
  },
}));

describe("normalizeAnthropicBaseURL", () => {
  it("returns falsy input unchanged (empty string)", () => {
    expect(normalizeAnthropicBaseURL("")).toBe("");
  });

  it("trims trailing slashes", () => {
    expect(normalizeAnthropicBaseURL("https://api.example.com/")).toBe(
      "https://api.example.com",
    );
    expect(normalizeAnthropicBaseURL("https://api.example.com///")).toBe(
      "https://api.example.com",
    );
  });

  it("strips a trailing '/v1/messages' (case-insensitive)", () => {
    expect(
      normalizeAnthropicBaseURL("https://api.example.com/anthropic/v1/messages"),
    ).toBe("https://api.example.com/anthropic");
    expect(
      normalizeAnthropicBaseURL("https://api.example.com/anthropic/V1/MESSAGES"),
    ).toBe("https://api.example.com/anthropic");
  });

  it("strips a trailing '/v1'", () => {
    expect(
      normalizeAnthropicBaseURL("https://api.example.com/anthropic/v1"),
    ).toBe("https://api.example.com/anthropic");
  });

  it("leaves a clean base URL untouched", () => {
    expect(normalizeAnthropicBaseURL("https://api.example.com/anthropic")).toBe(
      "https://api.example.com/anthropic",
    );
  });
});

describe("isAzureEndpoint", () => {
  it("matches *.azure.com hosts", () => {
    expect(isAzureEndpoint("https://my-res.openai.azure.com")).toBe(true);
  });

  it("matches *.cognitive.microsoft.com hosts", () => {
    expect(
      isAzureEndpoint("https://my-res.cognitive.microsoft.com/anthropic"),
    ).toBe(true);
  });

  it("matches *.services.ai.azure.com hosts", () => {
    expect(
      isAzureEndpoint("https://my-res.services.ai.azure.com/models"),
    ).toBe(true);
  });

  it("does not match api.anthropic.com", () => {
    expect(isAzureEndpoint("https://api.anthropic.com")).toBe(false);
  });
});

describe("AnthropicProvider tool mapping (toAnthropicTools)", () => {
  it("maps OpenAI tool defs to the Anthropic schema (name/description/input_schema)", () => {
    const mapped = toAnthropicTools(tools);
    for (let i = 0; i < mapped.length; i += 1) {
      const src = tools[i];
      if (src.type !== "function") continue;
      expect(mapped[i].name).toBe(src.function.name);
      expect(mapped[i].description).toBe(src.function.description ?? "");
      expect(mapped[i].input_schema).toEqual(src.function.parameters);
      expect(mapped[i].input_schema.type).toBe("object");
    }
  });

  it("preserves the tool count", () => {
    const functionCount = tools.filter((t) => t.type === "function").length;
    expect(toAnthropicTools(tools)).toHaveLength(functionCount);
  });

  it("defaults input_schema to an empty object schema when parameters are missing", () => {
    const mapped = toAnthropicTools([
      { type: "function", function: { name: "noargs", description: "d" } },
    ]);
    expect(mapped[0].input_schema).toEqual({ type: "object", properties: {} });
  });
});

describe("AiClientRouter", () => {
  it("getInstance returns a singleton", () => {
    expect(AiClientRouter.getInstance()).toBe(AiClientRouter.getInstance());
  });
});

// --- Tier 4 — provider runChat loops (mocked SDKs) ----------------------

function baseOptions(overrides: Partial<ChatRunOptions> = {}): ChatRunOptions {
  return {
    apiKey: "test-key",
    model: "test-model",
    baseURL: "https://example.com/v1",
    systemPrompt: "You are a test.",
    messages: [{ role: "user", content: "Bonjour" }],
    runTool: vi.fn(async () => ({ ok: true })),
    emitText: vi.fn(),
    ...overrides,
  };
}

describe("AiClientRouter.runChat — OpenAI provider", () => {
  beforeEach(() => {
    openaiCreate.mockReset();
    openaiCtor.mockReset();
    anthropicCreate.mockReset();
  });

  it("resolve() selects the OpenAI adapter for api 'openai' and undefined", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Salut" } }],
    });

    const undefRes = await AiClientRouter.getInstance().runChat(
      undefined,
      baseOptions(),
    );
    expect(undefRes.content).toBe("Salut");
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(anthropicCreate).not.toHaveBeenCalled();

    openaiCreate.mockClear();
    const openaiRes = await AiClientRouter.getInstance().runChat(
      "openai",
      baseOptions(),
    );
    expect(openaiRes.content).toBe("Salut");
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("returns assistant content directly when there are no tool calls", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Réponse finale" } }],
    });
    const res = await AiClientRouter.getInstance().runChat(
      "openai",
      baseOptions(),
    );
    expect(res.content).toBe("Réponse finale");
    expect(openaiCreate).toHaveBeenCalledTimes(1);
  });

  it("runs the tool-call loop: calls runTool, feeds results back, returns final text", async () => {
    const runTool = vi.fn(async () => ({ saved: true }));
    const emitText = vi.fn();

    // First response asks for a tool call; second returns final text.
    openaiCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "je réfléchis",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: JSON.stringify({ filePath: "cv.json" }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "Terminé" } }],
      });

    const res = await AiClientRouter.getInstance().runChat(
      "openai",
      baseOptions({ runTool, emitText }),
    );

    expect(runTool).toHaveBeenCalledWith("read_file", { filePath: "cv.json" });
    // Intermediate assistant text is streamed to the renderer.
    expect(emitText).toHaveBeenCalledWith("je réfléchis");
    // Second create() call includes the tool result message.
    const secondCallMessages = openaiCreate.mock.calls[1][0].messages;
    const toolMsg = secondCallMessages.find(
      (m: { role: string }) => m.role === "tool",
    );
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toBe(JSON.stringify({ saved: true }));
    expect(toolMsg.tool_call_id).toBe("call_1");
    expect(res.content).toBe("Terminé");
    expect(openaiCreate).toHaveBeenCalledTimes(2);
  });

  it("throws when the provider returns no choices", async () => {
    openaiCreate.mockResolvedValue({ choices: [] });
    await expect(
      AiClientRouter.getInstance().runChat("openai", baseOptions()),
    ).rejects.toThrow(/No response from AI agent/);
  });

  it("falls back to a placeholder when final content is null", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: null } }],
    });
    const res = await AiClientRouter.getInstance().runChat(
      "openai",
      baseOptions(),
    );
    expect(res.content).toBe("No content returned");
  });
});

describe("AiClientRouter.runChat — Anthropic provider", () => {
  beforeEach(() => {
    anthropicCreate.mockReset();
    anthropicCtor.mockReset();
    openaiCreate.mockReset();
  });

  it("resolve() selects the Anthropic adapter for api 'anthropic'", async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Bonjour du modèle" }],
    });

    const res = await AiClientRouter.getInstance().runChat(
      "anthropic",
      baseOptions(),
    );
    expect(res.content).toBe("Bonjour du modèle");
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("runs the tool_use loop and returns concatenated final text", async () => {
    const runTool = vi.fn(async () => ({ done: true }));
    const emitText = vi.fn();

    anthropicCreate
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "je consulte" },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "read_file",
            input: { filePath: "cv.json" },
          },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [
          { type: "text", text: "Voici " },
          { type: "text", text: "le résultat" },
        ],
      });

    const res = await AiClientRouter.getInstance().runChat(
      "anthropic",
      baseOptions({ runTool, emitText }),
    );

    expect(runTool).toHaveBeenCalledWith("read_file", { filePath: "cv.json" });
    expect(emitText).toHaveBeenCalledWith("je consulte");
    // Tool results are delivered as a user turn on the 2nd call.
    const secondMessages = anthropicCreate.mock.calls[1][0].messages;
    const userToolResult = secondMessages.find(
      (m: { role: string; content: unknown }) =>
        m.role === "user" && Array.isArray(m.content),
    );
    expect(userToolResult).toBeDefined();
    expect(userToolResult.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: JSON.stringify({ done: true }),
    });
    expect(res.content).toBe("Voici le résultat");
    expect(anthropicCreate).toHaveBeenCalledTimes(2);
  });

  it("passes systemPrompt as a top-level field and drops system messages from history", async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }],
    });

    await AiClientRouter.getInstance().runChat(
      "anthropic",
      baseOptions({
        systemPrompt: "SYSTÈME",
        messages: [
          { role: "system", content: "should be dropped" },
          { role: "user", content: "coucou" },
        ],
      }),
    );

    const call = anthropicCreate.mock.calls[0][0];
    expect(call.system).toBe("SYSTÈME");
    expect(
      call.messages.some((m: { role: string }) => m.role === "system"),
    ).toBe(false);
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0]).toEqual({ role: "user", content: "coucou" });
  });
});
