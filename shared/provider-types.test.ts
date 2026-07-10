/**
 * Tier 1 — runtime helpers in shared/provider-types.ts
 *
 * See tests/TEST_PLAN.md → "Tier 1: provider-types".
 */
import { describe, it, expect } from "vitest";
import { getPresetById, PROVIDER_PRESETS } from "./provider-types";

describe("getPresetById", () => {
  it("returns the matching preset for a known id (openai/gemini/ollama/custom)", () => {
    for (const id of ["openai", "gemini", "ollama", "custom"]) {
      const preset = getPresetById(id);
      expect(preset).toBeDefined();
      expect(preset?.id).toBe(id);
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getPresetById("does-not-exist")).toBeUndefined();
  });
});

describe("PROVIDER_PRESETS", () => {
  it("contains the expected preset ids", () => {
    expect(PROVIDER_PRESETS.map((p) => p.id)).toEqual([
      "openai",
      "gemini",
      "ollama",
      "custom",
    ]);
  });

  it("each preset has an api of 'openai' or 'anthropic'", () => {
    for (const preset of PROVIDER_PRESETS) {
      expect(["openai", "anthropic"]).toContain(preset.api);
    }
  });
});
