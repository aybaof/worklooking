import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { ResumeFieldChange } from "@/../shared/resumeDiff";

interface RoundDiffPanelProps {
  round: number;
  changes: ResumeFieldChange[];
}

/**
 * Collapsible French panel listing the leaf fields changed during the latest
 * regeneration round (before → after). Pure render; the diff is computed in
 * `useFeedbackLoop`. The displayed values are PII shown IN-MODAL ONLY and are
 * never sent into any prompt.
 */
export function RoundDiffPanel({ round, changes }: RoundDiffPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="rounded-lg border bg-card"
      data-testid="round-diff-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span>Modifications du tour n° {round}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t px-3 py-2">
          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune modification détectée pour ce tour.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {changes.map((change, i) => (
                <li key={i} className="text-xs">
                  <p className="font-medium">{change.label}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <span className="line-through">
                      {change.before || "(vide)"}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="text-foreground">
                      {change.after || "(vide)"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
