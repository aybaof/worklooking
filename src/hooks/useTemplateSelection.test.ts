/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useTemplateSelection".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useTemplateSelection } from "./useTemplateSelection";

describe("useTemplateSelection", () => {
  it.todo("loadSelectedTheme returns the stored theme when valid");
  it.todo("loadSelectedTheme falls back to the default for an invalid theme");
  it.todo("setSelectedTheme persists to localStorage");
  it.todo("renderPreview invokes RESUME_RENDER_PREVIEW via window.api");
  it.todo("availableThemes lists the 9 themes matching electron/themes/index.ts");
});
