import { useState, useCallback } from "react";
import { Channels } from "@/../shared/ipc";
import { Resume } from "@/../shared/resume-types";
import { PageMode } from "@/../shared/pageFit";

export interface ThemeInfo {
  id: string;
  label: string;
  description: string;
}

const STORAGE_KEY = "worklooking_selected_theme";
const DEFAULT_THEME = "modern-sidebar";

const PAGE_MODE_STORAGE_KEY = "worklooking_page_mode";
const DEFAULT_PAGE_MODE: PageMode = "multi-page";

export const availableThemes: ThemeInfo[] = [
  {
    id: "modern-sidebar",
    label: "Modern Sidebar",
    description:
      "Mise en page a deux colonnes avec barre laterale sombre. Photo, competences et langues dans la barre laterale.",
  },
  {
    id: "professional",
    label: "Professional",
    description:
      "Design epure et ATS-friendly. Police Calibri, mise en page classique a une colonne. Parfait pour les grandes entreprises.",
  },
  {
    id: "simple",
    label: "Simple",
    description:
      "Epure, noir et blanc, sans couleurs. Toutes les sections, typographie classique Georgia. Ideal pour l'impression.",
  },
  {
    id: "compact",
    label: "Compact",
    description:
      "Maximise la densite du contenu. Police Arial 9pt, marges reduites. Pour faire tenir beaucoup d'informations sur une page.",
  },
  {
    id: "elegant",
    label: "Elegant",
    description:
      "Sophistique avec police Garamond serif. Centrage elegant, small caps. Pour un CV distingue et raffine.",
  },
  {
    id: "creative",
    label: "Creative",
    description:
      "Moderne avec gradient violet et accents de couleur. Design audacieux pour secteurs creatifs et startups.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description:
      "Ultra-epure avec beaucoup d'espace blanc. Helvetica Neue light 300. Design zen et respire.",
  },
  {
    id: "bold",
    label: "Bold",
    description:
      "Typographie impactante avec Impact et Arial Black. Sections en noir inverse. Fait impression immediatement.",
  },
  {
    id: "spartan-fr",
    label: "Spartan FR",
    description:
      "Template complet traditionnel. Toutes les sections avec barres de niveau de competences. Font Awesome 4.7.",
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

function loadSelectedPageMode(): PageMode {
  try {
    const stored = localStorage.getItem(PAGE_MODE_STORAGE_KEY);
    if (stored === "one-page" || stored === "multi-page") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_PAGE_MODE;
}

export function useTemplateSelection() {
  const [selectedTheme, setSelectedThemeState] =
    useState<string>(loadSelectedTheme);
  const [selectedPageMode, setSelectedPageModeState] =
    useState<PageMode>(loadSelectedPageMode);

  const setSelectedTheme = useCallback((themeId: string) => {
    setSelectedThemeState(themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setSelectedPageMode = useCallback((pageMode: PageMode) => {
    setSelectedPageModeState(pageMode);
    try {
      localStorage.setItem(PAGE_MODE_STORAGE_KEY, pageMode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const renderPreview = useCallback(
    async (
      themeName: string,
      resumeJson: Resume,
      pageMode: PageMode = DEFAULT_PAGE_MODE,
    ): Promise<string> => {
      const response = await window.api.invoke(Channels.RESUME_RENDER_PREVIEW, {
        resumeJson,
        themeName,
        pageMode,
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
    selectedPageMode,
    setSelectedPageMode,
    availableThemes,
    renderPreview,
  };
}
