import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/useDebounce";
import { Check, Loader2 } from "lucide-react";
import { Resume } from "@/../shared/resume-types";
import { ThemeInfo } from "@/hooks/useTemplateSelection";

interface TemplateSelectorProps {
  resume: Resume;
  selectedTheme: string;
  availableThemes: ThemeInfo[];
  onSelectTheme: (themeId: string) => void;
  renderPreview: (themeName: string, resume: Resume) => Promise<string>;
}

interface PreviewCardProps {
  theme: ThemeInfo;
  resume: Resume;
  isSelected: boolean;
  onSelect: () => void;
  renderPreview: (themeName: string, resume: Resume) => Promise<string>;
}

function PreviewCard({
  theme,
  resume,
  isSelected,
  onSelect,
  renderPreview,
}: PreviewCardProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debouncedResume = useDebounce(resume, 1000);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    renderPreview(theme.id, debouncedResume)
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [theme.id, debouncedResume, renderPreview]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col rounded-xl border-2 transition-all duration-200 text-left overflow-hidden",
        "hover:shadow-lg hover:scale-[1.01]",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
          <Check className="w-4 h-4" />
        </div>
      )}

      {/* Preview area */}
      <div
        className="relative w-full bg-white overflow-hidden"
        style={{ height: 320 }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10 p-4">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}
        {html && (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title={`Apercu ${theme.label}`}
            sandbox="allow-same-origin"
            className="w-[210mm] h-[297mm] origin-top-left pointer-events-none"
            style={{
              transform: "scale(0.38)",
              transformOrigin: "top left",
              border: "none",
            }}
          />
        )}
      </div>

      {/* Info area */}
      <div className="p-4 border-t bg-card">
        <h4
          className={cn(
            "text-sm font-semibold mb-1",
            isSelected ? "text-primary" : "text-foreground",
          )}
        >
          {theme.label}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {theme.description}
        </p>
      </div>
    </button>
  );
}

export function TemplateSelector({
  resume,
  selectedTheme,
  availableThemes,
  onSelectTheme,
  renderPreview,
}: TemplateSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Modele de CV</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choisissez le modele utilise pour generer votre CV en HTML et PDF. Le
        modele selectionne sera aussi utilise par l'agent IA.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {availableThemes.map((theme) => (
          <PreviewCard
            key={theme.id}
            theme={theme}
            resume={resume}
            isSelected={selectedTheme === theme.id}
            onSelect={() => onSelectTheme(theme.id)}
            renderPreview={renderPreview}
          />
        ))}
      </div>
    </div>
  );
}
