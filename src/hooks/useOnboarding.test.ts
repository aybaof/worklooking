/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useOnboarding".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useOnboarding } from "./useOnboarding";

describe("useOnboarding", () => {
  it.todo("shouldShowTip returns true for a never-dismissed tip");
  it.todo("dismissTip marks a tip dismissed and persists the Set");
  it.todo("shouldShowTip returns false after dismissal");
  it.todo("hydrates dismissed tips from localStorage on init");
});
