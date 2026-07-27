import { cn } from "@/lib/utils";
import { PageMode } from "@/../shared/pageFit";

interface PageModeToggleProps {
  pageMode: PageMode;
  disabled?: boolean;
  onChange: (pageMode: PageMode) => void;
}

/**
 * Segmented one-page/multi-page control, styled like `ThemePickerRail`'s
 * toggle button. Pure presentation — the actual page-fit logic lives in
 * `PreviewFrame`.
 */
export function PageModeToggle({
  pageMode,
  disabled,
  onChange,
}: PageModeToggleProps) {
  return (
    <div className="flex rounded-lg border bg-background p-0.5 text-sm font-medium">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("one-page")}
        className={cn(
          "flex-1 rounded-md px-2 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          pageMode === "one-page"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted/50",
        )}
      >
        1 page
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("multi-page")}
        className={cn(
          "flex-1 rounded-md px-2 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          pageMode === "multi-page"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted/50",
        )}
      >
        Multi-page
      </button>
    </div>
  );
}
