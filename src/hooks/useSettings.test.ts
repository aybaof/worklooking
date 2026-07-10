/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useSettings".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useSettings } from "./useSettings";

describe("useSettings", () => {
  it.todo("handleProviderChange applies preset baseURL and model defaults");
  it.todo("derives api = customApi when provider is 'custom'");
  it.todo("derives api from the preset otherwise");
  it.todo("persists settings to localStorage");
  it.todo("migrates legacy candidature_config.json on startup");
});
