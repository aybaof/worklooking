/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useTemplateSelection".
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import { Channels } from "@/../shared/ipc";
import type { Resume } from "@/../shared/resume-types";
import { useTemplateSelection } from "./useTemplateSelection";

const STORAGE_KEY = "worklooking_selected_theme";
const DEFAULT_THEME = "modern-sidebar";

// The 9 theme IDs must stay in parity with electron/themes/index.ts.
const EXPECTED_THEME_IDS = [
  "modern-sidebar",
  "professional",
  "simple",
  "compact",
  "elegant",
  "creative",
  "minimal",
  "bold",
  "spartan-fr",
];

describe("useTemplateSelection", () => {
  let api: ReturnType<typeof installMockWindowApi>;

  beforeEach(() => {
    api = installMockWindowApi();
  });

  it("loadSelectedTheme returns the stored theme when valid", () => {
    localStorage.setItem(STORAGE_KEY, "creative");
    const { result } = renderHook(() => useTemplateSelection());
    expect(result.current.selectedTheme).toBe("creative");
  });

  it("loadSelectedTheme falls back to the default for an invalid theme", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-real-theme");
    const { result } = renderHook(() => useTemplateSelection());
    expect(result.current.selectedTheme).toBe(DEFAULT_THEME);
  });

  it("setSelectedTheme persists to localStorage", () => {
    const { result } = renderHook(() => useTemplateSelection());

    act(() => {
      result.current.setSelectedTheme("bold");
    });

    expect(result.current.selectedTheme).toBe("bold");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("bold");
  });

  it("renderPreview invokes RESUME_RENDER_PREVIEW via window.api", async () => {
    api.invoke.mockResolvedValueOnce({ html: "<div>preview</div>" });

    const { result } = renderHook(() => useTemplateSelection());
    const resume: Resume = { basics: { name: "Jane Doe" } };

    let html = "";
    await act(async () => {
      html = await result.current.renderPreview("professional", resume);
    });

    expect(api.invoke).toHaveBeenCalledWith(Channels.RESUME_RENDER_PREVIEW, {
      resumeJson: resume,
      themeName: "professional",
      pageMode: "multi-page",
    });
    expect(html).toBe("<div>preview</div>");
  });

  it("renderPreview throws when the IPC response contains an error", async () => {
    api.invoke.mockResolvedValueOnce({ error: "render failed" });

    const { result } = renderHook(() => useTemplateSelection());

    await expect(
      result.current.renderPreview("professional", {} as Resume),
    ).rejects.toThrow("render failed");
  });

  it("availableThemes lists the 9 themes matching electron/themes/index.ts", () => {
    const { result } = renderHook(() => useTemplateSelection());
    const ids = result.current.availableThemes.map((t) => t.id);

    expect(ids).toHaveLength(9);
    expect(ids).toEqual(EXPECTED_THEME_IDS);
  });
});
