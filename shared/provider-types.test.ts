/**
 * Tier 1 — runtime helpers in shared/provider-types.ts
 *
 * See tests/TEST_PLAN.md → "Tier 1: provider-types".
 */
import { describe, it } from "vitest";
// import { getPresetById, PROVIDER_PRESETS } from "./provider-types";

describe("getPresetById", () => {
  it.todo("returns the matching preset for a known id (openai/gemini/ollama/custom)");
  it.todo("returns undefined for an unknown id");
});

describe("PROVIDER_PRESETS", () => {
  it.todo("contains the expected preset ids");
  it.todo("each preset has an api of 'openai' or 'anthropic'");
});
