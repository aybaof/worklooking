/**
 * Tier 3 — renderer hook. Use `renderHook` + `act` from @testing-library/react.
 *
 * NOTE: despite the plan stub mentioning IPC, the current hook persists the
 * resume only to localStorage (no window.api call). Tests assert that real
 * behavior. The autosave effect depends on `isDirty`, so the save fires on the
 * render after a mutation rather than strictly after the useDebounce window.
 *
 * See tests/TEST_PLAN.md → "Tier 3: useResume".
 */
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Resume } from "@/../shared/resume-types";
import { useResume } from "./useResume";

const STORAGE_KEY = "worklooking_resume";

function readPersisted(): Resume {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("nothing persisted");
  return JSON.parse(raw) as Resume;
}

describe("useResume", () => {
  it("loads initial resume from localStorage", async () => {
    const stored: Resume = { basics: { name: "Ada Lovelace" }, work: [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useResume());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resume.basics?.name).toBe("Ada Lovelace");
  });

  it("updateBasics immutably updates a single field", () => {
    const { result } = renderHook(() => useResume());
    const before = result.current.resume;

    act(() => {
      result.current.updateBasics("name", "Grace Hopper");
    });

    expect(result.current.resume.basics?.name).toBe("Grace Hopper");
    expect(result.current.resume).not.toBe(before);
    expect(result.current.resume.basics).not.toBe(before.basics);
  });

  it("updateLocation updates nested basics.location", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.updateLocation("city", "Lyon");
    });

    expect(result.current.resume.basics?.location?.city).toBe("Lyon");
  });

  it("updateProfile / removeProfile manage basics.profiles", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.addItem("basics_profiles", {
        network: "",
        username: "",
        url: "",
      });
    });
    expect(result.current.resume.basics?.profiles).toHaveLength(1);

    act(() => {
      result.current.updateProfile(0, "network", "GitHub");
    });
    expect(result.current.resume.basics?.profiles?.[0].network).toBe("GitHub");

    act(() => {
      result.current.removeProfile(0);
    });
    expect(result.current.resume.basics?.profiles).toHaveLength(0);
  });

  it("addItem appends to an array section (e.g. work)", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.addItem("work", { name: "Acme", position: "Dev" });
    });

    expect(result.current.resume.work).toHaveLength(1);
    expect(result.current.resume.work?.[0]).toEqual({
      name: "Acme",
      position: "Dev",
    });
  });

  it("addItem handles the basics_profiles special case", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.addItem("basics_profiles", { network: "LinkedIn" });
    });

    // Goes into basics.profiles, not a top-level "basics_profiles" key.
    expect(result.current.resume.basics?.profiles).toHaveLength(1);
    expect(result.current.resume.basics?.profiles?.[0].network).toBe(
      "LinkedIn",
    );
    expect(
      (result.current.resume as Record<string, unknown>).basics_profiles,
    ).toBeUndefined();
  });

  it("removeItem removes by index", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.addItem("work", { name: "First" });
      result.current.addItem("work", { name: "Second" });
    });
    expect(result.current.resume.work).toHaveLength(2);

    act(() => {
      result.current.removeItem("work", 0);
    });
    expect(result.current.resume.work).toHaveLength(1);
    expect(result.current.resume.work?.[0].name).toBe("Second");
  });

  it("updateItem edits a field on an array item", () => {
    const { result } = renderHook(() => useResume());

    act(() => {
      result.current.addItem("work", { name: "Acme" });
    });
    act(() => {
      result.current.updateItem("work", 0, "position", "Lead");
    });

    expect(result.current.resume.work?.[0].position).toBe("Lead");
  });

  it("marks state dirty on change and clears after autosave", async () => {
    const { result } = renderHook(() => useResume());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateBasics("name", "Dirty Then Clean");
    });

    // Autosave (isDirty-driven) runs and resets the flag.
    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it("debounced autosave persists to localStorage", async () => {
    const { result } = renderHook(() => useResume());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateBasics("name", "Persisted");
    });

    await waitFor(() => {
      expect(readPersisted().basics?.name).toBe("Persisted");
    });
  });
});
