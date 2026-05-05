import { modernSidebar } from "./modern-sidebar";
import { spartanFr } from "./spartan-fr";
import { simple } from "./simple";
import { professional } from "./professional";
import { compact } from "./compact";
import { elegant } from "./elegant";
import { creative } from "./creative";
import { minimal } from "./minimal";
import { bold } from "./bold";

export const themes = {
  "modern-sidebar": modernSidebar,
  "spartan-fr": spartanFr,
  simple: simple,
  professional: professional,
  compact: compact,
  elegant: elegant,
  creative: creative,
  minimal: minimal,
  bold: bold,
} as const;

export type ThemeName = keyof typeof themes;
