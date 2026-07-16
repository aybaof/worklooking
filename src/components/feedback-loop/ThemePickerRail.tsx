import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Resume } from "@/../shared/resume-types";
import { ThemeInfo } from "@/hooks/useTemplateSelection";

interface ThemePickerRailProps {
  resume: Resume;
  selectedTheme: string;
  availableThemes: ThemeInfo[];
  disabled: boolean;
  onSelectTheme: (themeId: string) => void;
  renderPreview: (themeName: string, resume: Resume) => Promise<string>;
}

interface ThemeThumbnailProps {
  theme: ThemeInfo;
  resume: Resume;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  renderPreview: (themeName: string, resume: Resume) => Promise<string>;
}

/**
 * Compact, per-thumbnail live mini-preview for the feedback modal's narrow
 * rail. Modeled on `TemplateSelector`'s `PreviewCard` but smaller/simpler: no
 * debounce (the resume only changes on discrete rounds/reseeds here, not
 * continuous typing), smaller scaled iframe. Owns its own `html`/`isLoading`/
 * `error` state so a failed render for one theme never affects the others
 * (AC-13).
 */
function ThemeThumbnail({
  theme,
  resume,
  isSelected,
  disabled,
  onSelect,
  renderPreview,
}: ThemeThumbnailProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    renderPreview(theme.id, resume)
      .then((result) => {
        if (cancelled) return;
        setHtml(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [theme.id, resume, renderPreview]);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "relative flex flex-col rounded-lg border-2 text-left overflow-hidden transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
          <Check className="h-3 w-3" />
        </div>
      )}

      <div
        className="relative w-full overflow-hidden bg-white"
        style={{ height: 130 }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-destructive/10 p-2">
            <p className="text-center text-[10px] text-destructive">
              Aperçu indisponible
            </p>
          </div>
        )}
        {html && !error && (
          <iframe
            srcDoc={html}
            title={`Aperçu ${theme.label}`}
            sandbox="allow-same-origin"
            className="h-[297mm] w-[210mm] origin-top-left pointer-events-none"
            style={{
              transform: "scale(0.145)",
              transformOrigin: "top left",
              border: "none",
            }}
          />
        )}
      </div>

      <p
        className={cn(
          "truncate px-1.5 py-1 text-[11px] font-medium",
          isSelected ? "text-primary" : "text-foreground",
        )}
      >
        {theme.label}
      </p>
    </button>
  );
}

/**
 * Collapsed-by-default theme picker for the feedback modal's left rail: a
 * toggle labeled with the currently selected theme's name, expanding to a
 * compact grid of live per-theme thumbnails (reusing the same injected
 * `renderPreview` as the modal's main preview — no duplicated IPC call
 * sites). Disabled entirely while a regeneration round is in flight.
 */
export function ThemePickerRail({
  resume,
  selectedTheme,
  availableThemes,
  disabled,
  onSelectTheme,
  renderPreview,
}: ThemePickerRailProps) {
  const [expanded, setExpanded] = useState(false);
  const currentTheme = availableThemes.find((t) => t.id === selectedTheme);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className="truncate">
          Thème : {currentTheme?.label ?? selectedTheme}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto custom-scrollbar">
          {availableThemes.map((theme) => (
            <ThemeThumbnail
              key={theme.id}
              theme={theme}
              resume={resume}
              isSelected={theme.id === selectedTheme}
              disabled={disabled}
              onSelect={() => onSelectTheme(theme.id)}
              renderPreview={renderPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
