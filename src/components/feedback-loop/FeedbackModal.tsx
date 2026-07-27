import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Resume } from "@/../shared/resume-types";
import { ResumeFieldChange } from "@/../shared/resumeDiff";
import { ValidationResult } from "@/hooks/useFeedbackLoop";
import { ThemeInfo } from "@/hooks/useTemplateSelection";
import { PageMode } from "@/../shared/pageFit";
import { PreviewFrame } from "@/components/feedback-loop/PreviewFrame";
import { SectionPinRail } from "@/components/feedback-loop/SectionPinRail";
import { CommentPopover } from "@/components/feedback-loop/CommentPopover";
import { ThemePickerRail } from "@/components/feedback-loop/ThemePickerRail";
import { PageModeToggle } from "@/components/feedback-loop/PageModeToggle";
import { RegenControls } from "@/components/feedback-loop/RegenControls";
import { RoundDiffPanel } from "@/components/feedback-loop/RoundDiffPanel";
import { UnsavedCommentsConfirm } from "@/components/feedback-loop/UnsavedCommentsConfirm";
import { ValidationSuccessPanel } from "@/components/feedback-loop/ValidationSuccessPanel";

interface FeedbackModalProps {
  resume: Resume | null;
  comments: Record<string, string>;
  previewHtml: string;
  isPreviewLoading: boolean;
  isRegenerating: boolean;
  round: number;
  error: string | null;
  changes: ResumeFieldChange[];
  /** Section ids commented in the latest round (drives the "no change" flags). */
  commentedSectionIds: string[];
  activeTool: { name: string; status: string } | null;
  hasComments: boolean;
  /** Result of the last successful Valider write, or `null` if none yet. */
  validationResult: ValidationResult | null;
  /** The modal's currently selected theme (owned by `useFeedbackLoop`). */
  selectedTheme: string;
  availableThemes: ThemeInfo[];
  onSelectTheme: (themeId: string) => void;
  /** The modal's currently selected page mode (owned by `useFeedbackLoop`). */
  pageMode: PageMode;
  onSelectPageMode: (pageMode: PageMode) => void;
  /** Reused from `useTemplateSelection.renderPreview` — no IPC contract change. */
  renderThemePreview: (themeName: string, resume: Resume) => Promise<string>;
  setComment: (sectionId: string, value: string) => void;
  clearComment: (sectionId: string) => void;
  submitComments: () => void;
  validate: () => void;
  /** Reveal the generated file (PDF if present, else HTML) in the file explorer. */
  onRevealInFolder: () => void;
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
  changes,
  commentedSectionIds,
  activeTool,
  hasComments,
  validationResult,
  selectedTheme,
  availableThemes,
  onSelectTheme,
  pageMode,
  onSelectPageMode,
  renderThemePreview,
  setComment,
  clearComment,
  submitComments,
  validate,
  onRevealInFolder,
  onClose,
}: FeedbackModalProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  // Which action, if any, is awaiting unsaved-comments confirmation.
  const [confirm, setConfirm] = useState<null | "close" | "validate">(null);

  // Close on Escape (unless a regeneration is in flight). When there are
  // pending comments, prompt first instead of closing immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isRegenerating) return;
      if (hasComments) {
        setConfirm("close");
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRegenerating, onClose, hasComments]);

  if (!resume) return null;

  // Guarded close: prompt when there are unsaved comments, else close now.
  const requestClose = () => {
    if (hasComments) {
      setConfirm("close");
    } else {
      onClose();
    }
  };

  // Guarded validate: prompt when there are unsaved comments, else validate now.
  const handleValidate = () => {
    if (hasComments) {
      setConfirm("validate");
    } else {
      validate();
    }
  };

  const handleConfirm = () => {
    const mode = confirm;
    setConfirm(null);
    if (mode === "close") {
      onClose();
    } else if (mode === "validate") {
      validate();
    }
  };

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
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
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
            onClick={requestClose}
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

            <ThemePickerRail
              resume={resume}
              selectedTheme={selectedTheme}
              availableThemes={availableThemes}
              disabled={isRegenerating}
              onSelectTheme={onSelectTheme}
              renderPreview={renderThemePreview}
            />

            <PageModeToggle
              pageMode={pageMode}
              disabled={isRegenerating}
              onChange={onSelectPageMode}
            />

            <RegenControls
              isRegenerating={isRegenerating}
              hasComments={hasComments}
              round={round}
              error={error}
              activeTool={activeTool}
              onRegenerate={submitComments}
              onValidate={handleValidate}
            />

            {validationResult && (
              <ValidationSuccessPanel
                validationResult={validationResult}
                onRevealInFolder={onRevealInFolder}
              />
            )}

            {round > 0 && (
              <RoundDiffPanel
                round={round}
                changes={changes}
                commentedSectionIds={commentedSectionIds}
              />
            )}
          </aside>

          <section className="flex min-h-0 flex-1 overflow-hidden p-4">
            <PreviewFrame
              html={previewHtml}
              isLoading={isPreviewLoading}
              pageMode={pageMode}
            />
          </section>
        </div>
      </div>

      {confirm !== null && (
        <UnsavedCommentsConfirm
          mode={confirm}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
