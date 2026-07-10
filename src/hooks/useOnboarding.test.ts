/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useOnboarding".
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnboarding } from "./useOnboarding";

const STORAGE_KEY = "worklooking_dismissed_tips";

describe("useOnboarding", () => {
  it("shouldShowTip returns true for a never-dismissed tip", () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.shouldShowTip("welcome")).toBe(true);
  });

  it("dismissTip marks a tip dismissed and persists the Set", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.dismissTip("welcome");
    });

    expect(result.current.dismissedTips.has("welcome")).toBe(true);

    const persisted = localStorage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string)).toEqual(["welcome"]);
  });

  it("shouldShowTip returns false after dismissal", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.dismissTip("welcome");
    });

    expect(result.current.shouldShowTip("welcome")).toBe(false);
  });

  it("hydrates dismissed tips from localStorage on init", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["welcome", "resume"]));

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.dismissedTips.has("welcome")).toBe(true);
    expect(result.current.dismissedTips.has("resume")).toBe(true);
    expect(result.current.shouldShowTip("welcome")).toBe(false);
    expect(result.current.shouldShowTip("other")).toBe(true);
  });
});
