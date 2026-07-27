// Shared page-count / one-page-fit math, used by both the renderer preview
// (measuring an iframe's contentDocument) and the Electron main process
// (measuring a hidden BrowserWindow before printToPDF), so the two always
// agree on page count and shrink factor.

export type PageMode = "one-page" | "multi-page";

export const A4_HEIGHT_MM = 297;
export const MM_TO_PX = 96 / 25.4; // CSS mm -> px at 96dpi (Chromium's own mm unit)
export const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX;

// Floor below which we stop shrinking content (unreadable) and accept the
// content spilling onto a second page instead.
export const MIN_FIT_SCALE = 0.65;

export function computePageCount(naturalHeightPx: number): number {
  if (naturalHeightPx <= 0) return 1;
  return Math.max(1, Math.ceil(naturalHeightPx / A4_HEIGHT_PX));
}

// Returns 1 when the content already fits one page; otherwise the scale
// needed to fit it (clamped to MIN_FIT_SCALE).
export function computeFitScale(naturalHeightPx: number): number {
  if (naturalHeightPx <= A4_HEIGHT_PX) return 1;
  return Math.max(A4_HEIGHT_PX / naturalHeightPx, MIN_FIT_SCALE);
}
