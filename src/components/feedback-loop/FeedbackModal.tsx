import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Resume } from "@/../shared/resume-types";
import { PreviewFrame } from "@/components/feedback-loop/PreviewFrame";
import { SectionPinRail } from "@/components/feedback-loop/SectionPinRail";
import { CommentPopover } from "@/components/feedback-loop/CommentPopover";
import { RegenControls } from "@/components/feedback-loop/RegenControls";

interface FeedbackModalProps {
  resume: Resume | null;
  comments: Record<string, string>;
  previewHtml: string;
  isPreviewLoading: boolean;
  isRegenerating: boolean;
  round: number;
  error: string | null;
  activeTool: { name: string; status: string } | null;
  hasComments: boolean;
  setComment: (sectionId: string, value: string) => void;
  clearComment: (sectionId: string) => void;
  submitComments: () => void;
  validate: () => void;
  onClose: () => void;
}

/**
 * In-app CV feedback modal (single-window design). Renders the rail + themed
 * preview + regenerate/validate controls in an overlay above the main window.
 * All loop logic lives in `useFeedbackLoop`; this is pure presentation. French
 * copy throughout.
 */
export function FeedbackModal({
  resume,
  comments,
  previewHtml,
  isPreviewLoading,
  isRegenerating,
  round,
  error,
  activeTool,
  hasComments,
  setComment,
  clearComment,
  submitComments,
  validate,
  onClose,
}: FeedbackModalProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Close on Escape (unless a regeneration is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRegenerating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRegenerating, onClose]);

  if (!resume) return null;

  const handlePinClick = (sectionId: string) => {
    setActiveSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleCommentChange = (value: string) => {
    if (!activeSectionId) return;
    if (value.trim().length === 0) {
      clearComment(activeSectionId);
    } else {
      setComment(activeSectionId, value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold">Retours sur le CV</h2>
            <p className="text-sm text-muted-foreground">
              Commentez chaque section puis régénérez jusqu'à obtenir le
              résultat souhaité.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            disabled={isRegenerating}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-card p-4 custom-scrollbar">
            <SectionPinRail
              resume={resume}
              comments={comments}
              activeSectionId={activeSectionId}
              disabled={isRegenerating}
              onPinClick={handlePinClick}
            />

            {activeSectionId && (
              <CommentPopover
                sectionId={activeSectionId}
                value={comments[activeSectionId] || ""}
                disabled={isRegenerating}
                onChange={handleCommentChange}
                onClose={() => setActiveSectionId(null)}
              />
            )}

            <RegenControls
              isRegenerating={isRegenerating}
              hasComments={hasComments}
              round={round}
              error={error}
              activeTool={activeTool}
              onRegenerate={submitComments}
              onValidate={validate}
            />
          </aside>

          <section className="flex-1 overflow-hidden p-4">
            <PreviewFrame html={previewHtml} isLoading={isPreviewLoading} />
          </section>
        </div>
      </div>
    </div>
  );
}
