/**
 * Tier 1 — system prompt builder in electron/agent/prompt.ts
 *
 * CRITICAL security rule (AGENTS.md #7): no PII in the LLM prompt. These tests
 * are the executable guarantee of that rule — keep them strict.
 *
 * See tests/TEST_PLAN.md → "Tier 1: prompt.ts".
 */
import { describe, it } from "vitest";
// import { GenerateSystemPrompt } from "./prompt";

describe("GenerateSystemPrompt", () => {
  it.todo("embeds the agent.md instructions");
  it.todo("includes the candidature config JSON");
  it.todo("includes resume basics.summary and basics.label");
  it.todo("STRIPS basics.name from the prompt");
  it.todo("STRIPS basics.email / phone from the prompt");
  it.todo("STRIPS basics.image / photo from the prompt");
  it.todo("STRIPS basics.location (address) from the prompt");
  it.todo("STRIPS basics.profiles from the prompt");
  it.todo("handles an empty/undefined resume without throwing");
});
