import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedAppearance = "light" | "dark";

export interface UseThemeResult {
  /** Persisted user choice. */
  mode: ThemeMode;
  /** Appearance actually applied right now. */
  resolved: ResolvedAppearance;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "worklooking_theme";
const DEFAULT_MODE: ThemeMode = "system";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function loadMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MEDIA_QUERY).matches
  );
}

function resolveAppearance(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  if (mode === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return mode;
}

function applyClass(appearance: ResolvedAppearance): void {
  document.documentElement.classList.toggle("dark", appearance === "dark");
}

export function useTheme(): UseThemeResult {
  const [mode, setModeState] = useState<ThemeMode>(loadMode);
  const [resolved, setResolved] = useState<ResolvedAppearance>(() =>
    resolveAppearance(loadMode(), prefersDark()),
  );

  // Effect A — apply the resolved class and persist the mode whenever it
  // changes. Idempotent with the index.html pre-paint script.
  useEffect(() => {
    const appearance = resolveAppearance(mode, prefersDark());
    applyClass(appearance);
    setResolved(appearance);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, [mode]);

  // Effect B — subscribe to OS scheme changes only while in system mode.
  useEffect(() => {
    if (mode !== "system") {
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mql = window.matchMedia(MEDIA_QUERY);

    const handleChange = (event: MediaQueryListEvent): void => {
      const appearance: ResolvedAppearance = event.matches ? "dark" : "light";
      applyClass(appearance);
      setResolved(appearance);
    };

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
      return () => mql.removeEventListener("change", handleChange);
    }

    // Legacy Safari / older environments.
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  return { mode, resolved, setMode };
}
