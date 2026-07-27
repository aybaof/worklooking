import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PageMode,
  computeFitScale,
  computePageCount,
  MIN_FIT_SCALE,
  A4_HEIGHT_PX,
} from "@/../shared/pageFit";

interface PreviewFrameProps {
  html: string;
  isLoading: boolean;
  pageMode: PageMode;
}

/** Fallback page height (A4 portrait) until the iframe content is measured. */
const A4_FALLBACK_HEIGHT = "297mm";

/**
 * Sandboxed themed-preview iframe (reused pattern from
 * `TemplateSelector.PreviewCard`). Pure render.
 *
 * The preview renders the themed HTML at its TRUE CSS size — the theme uses
 * mm-based A4 page CSS (the same `renderResume` helper that produces the final
 * HTML/PDF), so the page is `210mm` wide and its natural height. It is NOT
 * scaled/squished to fit: the container scrolls (vertically, and horizontally
 * if the window is narrower than the page) so a multi-page CV scrolls like the
 * real PDF. The page sits on a neutral background, centered horizontally when
 * there is spare width.
 */
export function PreviewFrame({ html, isLoading, pageMode }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Measured NATURAL (unscaled) content height, taken once per `html` load,
  // before any one-page shrink is applied. Re-fitting on a `pageMode` toggle
  // (without a new `html` load) reads from this instead of re-measuring the
  // already-shrunk document.
  const [naturalHeightPx, setNaturalHeightPx] = useState<number | null>(null);
  // Size the outer iframe box (post-shrink height when in one-page mode) so a
  // multi-page CV scrolls in the outer container like the real PDF, and a
  // one-page CV sits at exactly one page height.
  const [contentHeight, setContentHeight] = useState<string>(A4_FALLBACK_HEIGHT);

  // Safe because the iframe is same-origin (`sandbox="allow-same-origin"`,
  // `srcDoc`); if the document is unreadable we keep the A4 fallback.
  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const measured = doc?.body?.scrollHeight;
    if (typeof measured === "number" && measured > 0) {
      setNaturalHeightPx(measured);
    }
  }, []);

  // Apply (or clear) the one-page shrink whenever the natural measurement or
  // the page-mode selection changes, without needing a fresh iframe load.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    const body = doc?.body;
    if (!body || naturalHeightPx == null) return;

    // Sidebar-split themes (e.g. modern-sidebar) are detected structurally —
    // `.sidebar` + `.main-content` inside `.resume` — rather than by theme
    // name, so this stays correct if other sidebar-style themes are added
    // later. For these, scaling the whole `body` would shrink the decorative
    // sidebar column too; instead only `.main-content` is scaled, and
    // `.resume` (whose height the sidebar stretches to fill, via its default
    // `align-items: stretch`) is pinned to exactly one A4 page height.
    const mainContent = doc?.querySelector(".main-content") as HTMLElement | null;
    const sidebar = doc?.querySelector(".sidebar") as HTMLElement | null;
    const resumeEl = doc?.querySelector(".resume") as HTMLElement | null;
    const isSidebarSplit = !!(mainContent && sidebar && resumeEl);

    if (pageMode === "one-page" && isSidebarSplit && mainContent && resumeEl) {
      // Reset any state from a previous run before measuring, so the
      // measurement below reflects the natural (unscaled) layout.
      mainContent.style.flex = "";
      mainContent.style.transform = "";
      mainContent.style.width = "";
      resumeEl.style.height = "";
      body.style.transform = "";
      body.style.width = "";

      const mainNatural = mainContent.scrollHeight;
      const scale = computeFitScale(mainNatural);
      if (scale < 1) {
        const naturalWidth = mainContent.getBoundingClientRect().width;
        // `flex: none` so the explicit width below isn't overridden by the
        // theme's `flex: 1` (flex-basis: 0%) sizing.
        mainContent.style.flex = "none";
        mainContent.style.transformOrigin = "top left";
        mainContent.style.transform = `scale(${scale})`;
        mainContent.style.width = `${naturalWidth / scale}px`;
        // `scale` is floored at MIN_FIT_SCALE, so scaled content may still
        // exceed one page height. Pinning `.resume` to exactly one page in
        // that case would let `.main-content` overflow past it (spilling
        // onto a blank second page). Instead grow `.resume` to match the
        // actual scaled height so `.sidebar` (align-items: stretch) stays
        // full height with no overflow gap.
        const scaledHeight = Math.max(A4_HEIGHT_PX, mainNatural * scale);
        resumeEl.style.height = `${scaledHeight}px`;
        setContentHeight(`${scaledHeight}px`);
      } else {
        setContentHeight(`${naturalHeightPx}px`);
      }
    } else if (pageMode === "one-page") {
      const scale = computeFitScale(naturalHeightPx);
      body.style.transformOrigin = "top left";
      body.style.transform = scale < 1 ? `scale(${scale})` : "";
      body.style.width = scale < 1 ? `${210 / scale}mm` : "";
      setContentHeight(`${naturalHeightPx * scale}px`);
    } else {
      body.style.transform = "";
      body.style.width = "";
      if (isSidebarSplit && mainContent && resumeEl) {
        mainContent.style.flex = "";
        mainContent.style.transform = "";
        mainContent.style.width = "";
        resumeEl.style.height = "";
      }
      setContentHeight(`${naturalHeightPx}px`);
    }
  }, [naturalHeightPx, pageMode]);

  const fitScale = naturalHeightPx != null ? computeFitScale(naturalHeightPx) : 1;
  const effectiveHeightPx =
    naturalHeightPx != null
      ? pageMode === "one-page"
        ? naturalHeightPx * fitScale
        : naturalHeightPx
      : null;
  const pageCount =
    effectiveHeightPx != null ? computePageCount(effectiveHeightPx) : null;
  const wasShrunkToMinimum = pageMode === "one-page" && fitScale <= MIN_FIT_SCALE;

  return (
    <div className="relative h-full w-full overflow-auto bg-muted/40 custom-scrollbar">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {html && pageCount != null && (
        <div
          className={cn(
            "absolute right-6 top-6 z-10 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
            wasShrunkToMinimum
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-border bg-background/90 text-foreground",
          )}
        >
          {pageCount} page{pageCount > 1 ? "s" : ""}
          {wasShrunkToMinimum && " (taille minimale atteinte)"}
        </div>
      )}
      {html && (
        <div className="flex min-h-full w-full justify-center p-4">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Aperçu du CV"
            sandbox="allow-same-origin"
            scrolling="no"
            onLoad={handleLoad}
            className="shrink-0 rounded-xl border bg-white shadow-sm"
            style={{ border: "none", width: "210mm", height: contentHeight }}
          />
        </div>
      )}
    </div>
  );
}
