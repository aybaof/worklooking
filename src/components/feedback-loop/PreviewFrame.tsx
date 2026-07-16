import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface PreviewFrameProps {
  html: string;
  isLoading: boolean;
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
export function PreviewFrame({ html, isLoading }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Measured natural content height so a multi-page CV scrolls in the outer
  // container (like the real PDF) instead of being clipped or scaled.
  const [contentHeight, setContentHeight] = useState<string>(A4_FALLBACK_HEIGHT);

  // Size the iframe to its rendered content height. Safe because the iframe is
  // same-origin (`sandbox="allow-same-origin"`, `srcDoc`); if the document is
  // unreadable we keep the A4 fallback. Pure layout concern (no business logic).
  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const measured = doc?.body?.scrollHeight;
    if (typeof measured === "number" && measured > 0) {
      setContentHeight(`${measured}px`);
    }
  }, []);

  return (
    <div className="relative h-full w-full overflow-auto bg-muted/40 custom-scrollbar">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
