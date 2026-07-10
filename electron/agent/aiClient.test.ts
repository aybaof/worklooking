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
import { describe, it } from "vitest";
// import { normalizeAnthropicBaseURL } from "./aiClient";

describe("normalizeAnthropicBaseURL", () => {
  it.todo("returns falsy input unchanged (empty string)");
  it.todo("trims trailing slashes");
  it.todo("strips a trailing '/v1/messages' (case-insensitive)");
  it.todo("strips a trailing '/v1'");
  it.todo("leaves a clean base URL untouched");
});

describe("isAzureEndpoint", () => {
  it.todo("matches *.azure.com hosts");
  it.todo("matches *.cognitive.microsoft.com hosts");
  it.todo("matches *.services.ai.azure.com hosts");
  it.todo("does not match api.anthropic.com");
});

describe("AnthropicProvider tool mapping", () => {
  it.todo("maps OpenAI tool defs to the Anthropic schema (name/description/input_schema)");
  it.todo("preserves the tool count");
});

describe("AiClientRouter.resolve", () => {
  it.todo("returns the Anthropic provider for api='anthropic'");
  it.todo("returns the OpenAI provider for api='openai'");
  it.todo("getInstance returns a singleton");
});

describe("provider runChat loops (mocked SDK)", () => {
  it.todo("OpenAIProvider.runChat executes a tool call then returns final text");
  it.todo("AnthropicProvider.runChat executes a tool call then returns final text");
  it.todo("surfaces provider errors as AI_ERROR");
});
