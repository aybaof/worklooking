import { useState, useCallback } from "react";
import { Channels } from "@/../shared/ipc";
import { Resume } from "@/../shared/resume-types";

export interface ThemeInfo {
  id: string;
  label: string;
  description: string;
}

const STORAGE_KEY = "worklooking_selected_theme";
const DEFAULT_THEME = "modern-sidebar";

export const availableThemes: ThemeInfo[] = [
  {
    id: "modern-sidebar",
    label: "Modern Sidebar",
    description:
      "Mise en page a deux colonnes avec barre laterale sombre. Photo, competences et langues dans la barre laterale.",
  },
  {
    id: "spartan-fr",
    label: "Spartan FR",
    description:
      "Mise en page traditionnelle a une colonne. Complet avec toutes les sections et barres de niveau.",
  },
  {
    id: "simple",
    label: "Simple",
    description:
      "Epure, noir et blanc, sans couleurs. Toutes les sections, typographie classique. Ideal pour l'impression.",
  },
];

function loadSelectedTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && availableThemes.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME;
}

export function useTemplateSelection() {
  const [selectedTheme, setSelectedThemeState] =
    useState<string>(loadSelectedTheme);

  const setSelectedTheme = useCallback((themeId: string) => {
    setSelectedThemeState(themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const renderPreview = useCallback(
    async (themeName: string, resumeJson: Resume): Promise<string> => {
      const response = await window.api.invoke(Channels.RESUME_RENDER_PREVIEW, {
        resumeJson,
        themeName,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.html || "";
    },
    [],
  );

  return {
    selectedTheme,
    setSelectedTheme,
    availableThemes,
    renderPreview,
  };
}
