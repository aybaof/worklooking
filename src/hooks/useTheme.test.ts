/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useTheme".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";

const STORAGE_KEY = "worklooking_theme";

/**
 * jsdom has no `matchMedia`. Install a controllable mock that records
 * listeners so tests can emit OS scheme changes and assert cleanup.
 */
function installMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    ),
    removeEventListener: vi.fn(
      (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    ),
    addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    ),
    removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
    ),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
  window.matchMedia = vi
    .fn()
    .mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    mql,
    emit: (m: boolean) => {
      mql.matches = m;
      listeners.forEach((cb) => cb({ matches: m } as MediaQueryListEvent));
    },
  };
}

function hasDarkClass(): boolean {
  return document.documentElement.classList.contains("dark");
}

describe("useTheme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
    // jsdom has no matchMedia; installMatchMedia assigns one. Remove it so a
    // later test that expects the absence guard sees a truly undefined API.
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("defaults to system when no key is stored (AC1)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
  });

  it("falls back to system for a corrupt stored value without throwing (AC12)", () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "banana");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
  });

  it("reads a stored dark mode on init and applies .dark (AC7)", () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("dark");
    expect(hasDarkClass()).toBe(true);
  });

  it("light mode does not apply the .dark class (AC2)", () => {
    installMatchMedia(true); // OS dark, but manual light wins
    localStorage.setItem(STORAGE_KEY, "light");
    renderHook(() => useTheme());
    expect(hasDarkClass()).toBe(false);
  });

  it("dark mode applies the .dark class (AC3)", () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "dark");
    renderHook(() => useTheme());
    expect(hasDarkClass()).toBe(true);
  });

  it("system mode follows OS dark preference (AC3)", () => {
    installMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, "system");
    renderHook(() => useTheme());
    expect(hasDarkClass()).toBe(true);
  });

  it("system mode follows OS light preference (AC2)", () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    renderHook(() => useTheme());
    expect(hasDarkClass()).toBe(false);
  });

  it("setMode writes exactly the literal to worklooking_theme and no other key (AC4)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("dark");
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(localStorage.length).toBe(1);
  });

  it("persists each of the three literal modes verbatim under the one key (AC4)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    for (const value of ["light", "dark", "system"] as const) {
      act(() => {
        result.current.setMode(value);
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(value);
      // Only worklooking_theme is ever touched — no stray keys.
      expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
    }
  });

  it("reflects live OS changes while in system mode (AC5)", () => {
    const { emit } = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    const { result } = renderHook(() => useTheme());
    expect(hasDarkClass()).toBe(false);
    expect(result.current.resolved).toBe("light");

    act(() => {
      emit(true);
    });
    expect(hasDarkClass()).toBe(true);
    expect(result.current.resolved).toBe("dark");

    act(() => {
      emit(false);
    });
    expect(hasDarkClass()).toBe(false);
    expect(result.current.resolved).toBe("light");
  });

  it("re-enters system mode and resumes following the OS after a manual override (AC5/AC6)", () => {
    const { emit } = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    const { result } = renderHook(() => useTheme());

    // Manual dark override — OS changes must be ignored.
    act(() => {
      result.current.setMode("dark");
    });
    expect(hasDarkClass()).toBe(true);
    act(() => {
      emit(false);
    });
    expect(hasDarkClass()).toBe(true);

    // Back to system with OS light — appearance re-resolves and follows again.
    act(() => {
      result.current.setMode("system");
    });
    expect(hasDarkClass()).toBe(false);
    act(() => {
      emit(true);
    });
    expect(hasDarkClass()).toBe(true);
  });

  it("ignores OS changes in a manual mode (AC6)", () => {
    const { emit } = installMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("light");
    });
    expect(hasDarkClass()).toBe(false);

    act(() => {
      emit(true);
    });
    expect(hasDarkClass()).toBe(false);
  });

  it("removes the matchMedia listener when leaving system mode (AC13)", () => {
    const { mql } = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    const { result } = renderHook(() => useTheme());

    expect(mql.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );

    act(() => {
      result.current.setMode("light");
    });
    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    // The listener that was added is exactly the one that was removed — no leak.
    const added = mql.addEventListener.mock.calls[0][1];
    const removed = mql.removeEventListener.mock.calls[0][1];
    expect(removed).toBe(added);
  });

  it("removes the matchMedia listener on unmount while in system mode (AC13)", () => {
    const { mql } = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    const { unmount } = renderHook(() => useTheme());

    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(mql.removeEventListener).not.toHaveBeenCalled();

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("installs no matchMedia listener in a manual mode (AC6/AC13)", () => {
    const { mql } = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "dark");
    renderHook(() => useTheme());

    expect(mql.addEventListener).not.toHaveBeenCalled();
  });

  it("uses the legacy addListener/removeListener API when addEventListener is absent (AC5/AC13)", () => {
    const { mql } = installMatchMedia(false);
    // Simulate an older environment lacking addEventListener.
    (mql as unknown as { addEventListener: unknown }).addEventListener =
      undefined;
    localStorage.setItem(STORAGE_KEY, "system");
    const { unmount } = renderHook(() => useTheme());

    expect(mql.addListener).toHaveBeenCalledWith(expect.any(Function));

    unmount();
    expect(mql.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not throw when matchMedia is unavailable (matchMedia-absence guard)", () => {
    // No installMatchMedia — jsdom leaves window.matchMedia undefined.
    localStorage.setItem(STORAGE_KEY, "system");
    expect(() => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.mode).toBe("system");
      expect(hasDarkClass()).toBe(false);
    }).not.toThrow();
  });
});
