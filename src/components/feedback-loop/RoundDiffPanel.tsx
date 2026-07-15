import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { ResumeFieldChange } from "@/../shared/resumeDiff";
import {
  RESUME_SECTIONS,
  getResumeSectionLabel,
} from "@/../shared/resume-sections";

interface RoundDiffPanelProps {
  round: number;
  changes: ResumeFieldChange[];
  /** Section ids commented this round, used to surface LLM no-ops. */
  commentedSectionIds: string[];
}

interface DiffGroup {
  sectionId: string;
  sectionLabel: string;
  changes: ResumeFieldChange[];
}

/** Stable display order: `RESUME_SECTIONS` index, then unknown keys last. */
function sectionOrder(sectionId: string): number {
  const index = RESUME_SECTIONS.findIndex((s) => s.id === sectionId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * Group leaf changes by their structured `sectionId`, preserving section order,
 * then append commented sections that produced NO change so the panel can flag
 * LLM no-ops. Pure view transform.
 */
function buildGroups(
  changes: ResumeFieldChange[],
  commentedSectionIds: string[],
): DiffGroup[] {
  const byId = new Map<string, DiffGroup>();

  for (const change of changes) {
    const existing = byId.get(change.sectionId);
    if (existing) {
      existing.changes.push(change);
    } else {
      byId.set(change.sectionId, {
        sectionId: change.sectionId,
        sectionLabel: change.sectionLabel,
        changes: [change],
      });
    }
  }

  // Commented sections with no change → empty group (no-op indicator).
  for (const id of commentedSectionIds) {
    if (!byId.has(id)) {
      byId.set(id, {
        sectionId: id,
        sectionLabel: getResumeSectionLabel(id),
        changes: [],
      });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => sectionOrder(a.sectionId) - sectionOrder(b.sectionId),
  );
}

/**
 * Collapsible French panel listing the fields changed during the latest
 * regeneration round, grouped under their section headers (before → after).
 * A commented section that produced no change surfaces a "no change" row so the
 * user knows the LLM was a no-op and can retry. Pure render; the diff is
 * computed in `useFeedbackLoop`. Displayed values are PII shown IN-MODAL ONLY
 * and are never sent into any prompt.
 */
export function RoundDiffPanel({
  round,
  changes,
  commentedSectionIds,
}: RoundDiffPanelProps) {
  const [open, setOpen] = useState(true);

  const groups = buildGroups(changes, commentedSectionIds);

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
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune modification détectée pour ce tour.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.sectionId} className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.sectionLabel}
                  </p>
                  {group.changes.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                      Aucune modification détectée (l'IA n'a rien changé).
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {group.changes.map((change, i) => (
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
