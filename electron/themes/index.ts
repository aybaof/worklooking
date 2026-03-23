import { modernSidebar } from "./modern-sidebar";
import { spartanFr } from "./spartan-fr";
import { simple } from "./simple";

export const themes = {
  "modern-sidebar": modernSidebar,
  "spartan-fr": spartanFr,
  simple: simple,
} as const;

export type ThemeName = keyof typeof themes;
