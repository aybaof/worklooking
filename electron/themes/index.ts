import { modernSidebar } from './modern-sidebar';
import { spartanFr } from './spartan-fr';

export const themes = {
  'modern-sidebar': modernSidebar,
  'spartan-fr': spartanFr,
} as const;

export type ThemeName = keyof typeof themes;
