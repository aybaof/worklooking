import { Loader2 } from "lucide-react";

interface PreviewFrameProps {
  html: string;
  isLoading: boolean;
}

/**
 * Sandboxed themed-preview iframe (reused pattern from
 * `TemplateSelector.PreviewCard`). Pure render.
 */
export function PreviewFrame({ html, isLoading }: PreviewFrameProps) {
  return (
    <div className="relative w-full h-full bg-white overflow-auto rounded-xl border">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {html && (
        <iframe
          srcDoc={html}
          title="Aperçu du CV"
          sandbox="allow-same-origin"
          className="w-full h-full"
          style={{ border: "none", minHeight: "297mm" }}
        />
      )}
    </div>
  );
}
