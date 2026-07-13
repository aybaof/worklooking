import { Resume } from "@/../shared/resume-types";
import { RESUME_SECTIONS } from "@/../shared/resume-sections";
import { cn } from "@/lib/utils";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

interface SectionPinRailProps {
  resume: Resume;
  comments: Record<string, string>;
  activeSectionId: string | null;
  disabled: boolean;
  onPinClick: (sectionId: string) => void;
}

/**
 * Renders one clickable pin per section present in the resume (per
 * `RESUME_SECTIONS.hasContent`), so empty/absent sections never produce broken
 * pins. Highlights sections that already carry a comment. Pure render.
 */
export function SectionPinRail({
  resume,
  comments,
  activeSectionId,
  disabled,
  onPinClick,
}: SectionPinRailProps) {
  const presentSections = RESUME_SECTIONS.filter((section) =>
    section.hasContent(resume),
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Sections du CV
      </h3>
      <p className="text-xs text-muted-foreground mb-2">
        Cliquez sur une section pour laisser un commentaire.
      </p>
      {presentSections.map((section) => {
        const hasComment = (comments[section.id] || "").trim().length > 0;
        const isActive = activeSectionId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            disabled={disabled}
            onClick={() => onPinClick(section.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                : "border-border hover:border-muted-foreground/40 hover:bg-accent",
            )}
          >
            <span className="truncate">{section.label}</span>
            {hasComment ? (
              <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
            ) : (
              <MessageSquarePlus className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
}
