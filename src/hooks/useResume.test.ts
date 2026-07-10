/**
 * Tier 3 — renderer hook. Use `renderHook` + `act` from @testing-library/react.
 * Mock `window.api` (see tests/renderer/mockWindowApi.ts helper — create it per
 * the plan) and use fake timers for the debounced autosave.
 *
 * See tests/TEST_PLAN.md → "Tier 3: useResume".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useResume } from "./useResume";

describe("useResume", () => {
  it.todo("loads initial resume from localStorage");
  it.todo("updateBasics immutably updates a single field");
  it.todo("updateLocation updates nested basics.location");
  it.todo("updateProfile / removeProfile manage basics.profiles");
  it.todo("addItem appends to an array section (e.g. work)");
  it.todo("addItem handles the basics_profiles special case");
  it.todo("removeItem removes by index");
  it.todo("updateItem edits a field on an array item");
  it.todo("marks state dirty on change and clears after autosave");
  it.todo("debounced autosave persists to localStorage / IPC");
});
