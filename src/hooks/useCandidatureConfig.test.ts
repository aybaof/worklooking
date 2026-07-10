/**
 * Tier 3 — renderer hook (parallel to useResume).
 * See tests/TEST_PLAN.md → "Tier 3: useCandidatureConfig".
 */
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { CandidatureConfig } from "@/../shared/candidature-types";
import { useCandidatureConfig } from "./useCandidatureConfig";

const STORAGE_KEY = "worklooking_candidature_config";

function readPersisted(): CandidatureConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("nothing persisted");
  return JSON.parse(raw) as CandidatureConfig;
}

describe("useCandidatureConfig", () => {
  it("loads initial config from localStorage", async () => {
    const stored: CandidatureConfig = {
      candidate: {
        name: "Jean Dupont",
        position: "Développeur",
        location: "Paris",
        experience: "5 ans",
        languages: ["FR"],
        skills: [{ category: "Backend", technologies: "Node.js" }],
        strengths: ["Autonome"],
      },
      goals: {
        salary_target: "50k",
        contract_type: "CDI",
        remote_policy: "hybride",
        criteria: [],
      },
      target_companies: [],
      applications: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useCandidatureConfig());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.config.candidate.name).toBe("Jean Dupont");
    expect(result.current.config.candidate.skills[0].technologies).toBe(
      "Node.js",
    );
  });

  it("updateCandidate updates candidate fields immutably", () => {
    const { result } = renderHook(() => useCandidatureConfig());
    const before = result.current.config;

    act(() => {
      result.current.updateCandidate("name", "Marie");
    });

    expect(result.current.config.candidate.name).toBe("Marie");
    expect(result.current.config).not.toBe(before);
    expect(result.current.config.candidate).not.toBe(before.candidate);
  });

  it("adds / updates / removes candidate skills", () => {
    const { result } = renderHook(() => useCandidatureConfig());

    act(() => {
      result.current.addCandidateSkill();
    });
    expect(result.current.config.candidate.skills).toHaveLength(1);

    act(() => {
      result.current.updateCandidateSkill(0, "category", "Frontend");
      result.current.updateCandidateSkill(0, "technologies", "React");
    });
    expect(result.current.config.candidate.skills[0]).toEqual({
      category: "Frontend",
      technologies: "React",
    });

    act(() => {
      result.current.removeCandidateSkill(0);
    });
    expect(result.current.config.candidate.skills).toHaveLength(0);
  });

  it("updateGoals updates goals", () => {
    const { result } = renderHook(() => useCandidatureConfig());

    act(() => {
      result.current.updateGoals("salary_target", "60k");
    });

    expect(result.current.config.goals.salary_target).toBe("60k");
  });

  it("addItem / removeItem / updateItem manage target_companies", () => {
    const { result } = renderHook(() => useCandidatureConfig());

    act(() => {
      result.current.addItem("target_companies", {
        name: "",
        sector: "",
        reason: "",
        stack: "",
      });
    });
    expect(result.current.config.target_companies).toHaveLength(1);

    act(() => {
      result.current.updateItem("target_companies", 0, "name", "Acme");
    });
    expect(result.current.config.target_companies[0].name).toBe("Acme");

    act(() => {
      result.current.removeItem("target_companies", 0);
    });
    expect(result.current.config.target_companies).toHaveLength(0);
  });

  it("addItem / removeItem / updateItem manage applications", () => {
    const { result } = renderHook(() => useCandidatureConfig());

    act(() => {
      result.current.addItem("applications", {
        company: "",
        position: "",
        date: "",
        status: "",
        follow_up: "",
        notes_path: "",
      });
    });
    expect(result.current.config.applications).toHaveLength(1);

    act(() => {
      result.current.updateItem("applications", 0, "company", "Globex");
      result.current.updateItem("applications", 0, "status", "envoyée");
    });
    expect(result.current.config.applications[0].company).toBe("Globex");
    expect(result.current.config.applications[0].status).toBe("envoyée");

    act(() => {
      result.current.removeItem("applications", 0);
    });
    expect(result.current.config.applications).toHaveLength(0);
  });

  it("autosave persists changes and clears the dirty flag", async () => {
    const { result } = renderHook(() => useCandidatureConfig());

    // Let the initial load effect settle (no stored config) so
    // initialLoadDone is true before we mutate.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateCandidate("name", "Autosaved");
    });

    // The autosave effect depends on isDirty, so the save fires on the
    // render after the mutation rather than after the useDebounce window.
    await waitFor(() => {
      expect(readPersisted().candidate.name).toBe("Autosaved");
    });
    expect(result.current.isDirty).toBe(false);
  });
});
