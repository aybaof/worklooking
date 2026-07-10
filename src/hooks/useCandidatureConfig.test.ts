/**
 * Tier 3 — renderer hook (parallel to useResume).
 * See tests/TEST_PLAN.md → "Tier 3: useCandidatureConfig".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useCandidatureConfig } from "./useCandidatureConfig";

describe("useCandidatureConfig", () => {
  it.todo("loads initial config from localStorage");
  it.todo("updateCandidate updates candidate fields immutably");
  it.todo("adds / updates / removes candidate skills");
  it.todo("updateGoals updates goals");
  it.todo("addItem / removeItem / updateItem manage target_companies");
  it.todo("addItem / removeItem / updateItem manage applications");
  it.todo("debounced autosave persists changes");
});
