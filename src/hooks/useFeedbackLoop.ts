import { useState, useEffect, useCallback, useRef } from "react";
import { Channels } from "@/../shared/ipc";
import { Resume } from "@/../shared/resume-types";
import {
  SectionComment,
  buildRegenerationMessage,
} from "@/../shared/feedbackMessages";
import { diffResumes, ResumeFieldChange } from "@/../shared/resumeDiff";
import { mergeScopedResume } from "@/../shared/resumeMerge";

/**
 * Result of a successful deterministic Valider write (`resume:generate-final`),
 * surfaced by `FeedbackModal`'s success panel. `warning` carries the
 * partial-PDF-failure message (HTML written, PDF generation failed) — when
 * set, `pdfPath` is absent.
 */
export interface ValidationResult {
  htmlPath?: string;
  pdfPath?: string;
  warning?: string;
}

interface UseFeedbackLoopOptions {
  /**
   * App-wide default theme from `useTemplateSelection`, used ONLY to seed the
   * modal's own local `selectedTheme` on each reseed (a NEW `initialResume`) —
   * NOT the theme actually rendered/sent, which is the hook's own local
   * `selectedTheme` state (see below).
   */
  defaultTheme: string;
  /**
   * The tailored resume that opened the loop, or `null` when the modal is
   * closed. Changing this to a new resume (re)seeds the loop.
   */
  initialResume: Resume | null;
  /**
   * Company/position captured from the SAME `render_resume_html` call that
   * produced `initialResume` (when the model supplied them). Seeds the hook's
   * own `company`/`position` state on the SAME reseed guard as
   * `initialResume`.
   */
  initialCompany?: string;
  initialPosition?: string;
  /**
   * Continue the SAME chat conversation with a feedback message and return the
   * new tailored resume (provided by `useChat` — the loop runs in the main
   * window, not a second BrowserWindow). Only used for regeneration rounds
   * (`submitComments`) — Valider no longer goes through the chat loop.
   */
  sendFeedbackMessage: (content: string) => Promise<{
    resume: Resume | null;
    error?: string;
    company?: string;
    position?: string;
  }>;
  /**
   * Injected from `useTemplateSelection.renderPreview` so the main preview
   * effect reuses the exact same IPC-wrapping function as the thumbnail grid
   * (`ThemePickerRail`) — no duplicated `Channels.RESUME_RENDER_PREVIEW` call
   * sites.
   */
  renderPreview: (themeName: string, resume: Resume) => Promise<string>;
  /** Persist the validated resume (existing `useResume` auto-save owner). */
  onValidated: (resume: Resume) => void;
  /**
   * Called ONLY on a successful `validate()`, with the modal's currently
   * selected theme, so the caller (`App.tsx`) can promote it to the app-wide
   * default via `templateSelection.setSelectedTheme`. Never called on a
   * blocked Valider, a failed/rejected IPC call, a plain regeneration round
   * (`submitComments`), or `close()`.
   */
  onThemeValidated: (themeId: string) => void;
  /**
   * Called ONLY on a FULL `validate()` success — `response.pdfPath` present
   * AND `response.error` absent (the SAME condition that triggers auto-close,
   * AC-1). Lets `App.tsx` append the chat attachment message and run the
   * candidature match-or-create write. Never called on partial success
   * (warning set), blocked, error outcomes, `submitComments`, or `close()`.
   */
  onFullValidationSuccess?: (result: {
    company: string;
    position: string;
    htmlPath: string;
    pdfPath: string;
  }) => void;
  /** Close the modal. */
  onClose: () => void;
}

/**
 * Owns the CV feedback-loop logic (hooks-own-logic rule). The loop runs INSIDE
 * the main window as a modal overlay (single-window design — the earlier
 * second-`BrowserWindow` approach was dropped as it was unreliable). The hook
 * holds ephemeral draft comments + the current tailored resume + rendered
 * preview, drives REGENERATION rounds by continuing the SAME chat conversation
 * via `sendFeedbackMessage`, and drives the final VALIDATION write
 * deterministically via the `resume:generate-final` IPC channel (no LLM
 * round-trip).
 *
 * - `initialResume`/`initialCompany`/`initialPosition` seed the loop when the
 *   modal opens; `company`/`position` retain the LATEST non-empty values
 *   across regeneration rounds within a session.
 * - `submitComments` compiles the PII-free French message, sends it through the
 *   chat loop, and on success applies a deterministic section-scoped merge
 *   (`mergeScopedResume`) — only commented sections come from the LLM, the rest
 *   (incl. all `basics` PII / `meta` / unknown keys) stay from the pre-regen
 *   resume — then clears comments (AC-7); on error preserves comments and
 *   unlocks (AC-12).
 * - `validate` calls `resume:generate-final` DIRECTLY (no chat loop at all):
 *   blocked (company/position empty) sets an inline French error and makes no
 *   IPC call; an IPC error/`success: false` sets an inline French error and
 *   stays open/retryable; on `success: true` it persists the resume
 *   (`onValidated`) WITHOUT closing the modal, exposing `validationResult` so
 *   `FeedbackModal` can render the success state + "reveal in folder" action.
 * - `changes` holds the leaf-field diff between the previous and the MERGED
 *   resume for the latest regeneration round (in-modal display only — PII-safe,
 *   never sent into a prompt). `lastRoundCommentedIds` lists the section ids
 *   commented this round so the panel can flag LLM no-ops.
 * - No `localStorage` / disk persistence of loop state (AC-11).
 * - **Modal-local theme selection.** `selectedTheme` is OWNED by this hook
 *   (not a fixed prop): it is seeded from `defaultTheme` on the SAME
 *   `seededRef`-guarded reseed effect as comments/round/etc., so it tracks
 *   whatever the app-wide default currently is each time a NEW tailored
 *   resume opens the modal, but is otherwise free to diverge as the user
 *   clicks through the `ThemePickerRail` — purely a rendering concern for the
 *   SAME resume/round, so it never touches comments/round/diff/validation
 *   state. The main preview effect and `validate()` both use this local
 *   value (via the injected `renderPreview`), and `onThemeValidated` promotes
 *   it to the app-wide default ONLY on a successful `validate()`.
 */
export function useFeedbackLoop({
  defaultTheme,
  initialResume,
  initialCompany,
  initialPosition,
  sendFeedbackMessage,
  renderPreview,
  onValidated,
  onThemeValidated,
  onFullValidationSuccess,
  onClose,
}: UseFeedbackLoopOptions) {
  const [resume, setResume] = useState<Resume | null>(initialResume);
  const [selectedTheme, setSelectedTheme] = useState<string>(defaultTheme);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ResumeFieldChange[]>([]);
  const [lastRoundCommentedIds, setLastRoundCommentedIds] = useState<string[]>(
    [],
  );
  // Latest non-empty company/position known for this modal session (AC-4).
  const [company, setCompany] = useState<string | undefined>(initialCompany);
  const [position, setPosition] = useState<string | undefined>(
    initialPosition,
  );
  // Set on a successful `validate()`; cleared on reseed or the next
  // regeneration round (a further round invalidates the prior validation).
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  /**
   * The `initialResume` reference already seeded into the loop. Guards the
   * reseed effect so an `updatedResume` returned by validation (or any other
   * incidental reference change) can never re-open or re-seed the modal
   * (AC-7). The modal is unmounted anyway once `onClose` clears `feedbackResume`
   * to `null` in `App`, so this is defense-in-depth.
   */
  const seededRef = useRef<Resume | null>(null);

  // Reseed the loop only when a NEW tailored resume opens the modal.
  useEffect(() => {
    if (initialResume && seededRef.current !== initialResume) {
      seededRef.current = initialResume;
      setResume(initialResume);
      setSelectedTheme(defaultTheme);
      setComments({});
      setRound(0);
      setError(null);
      setChanges([]);
      setLastRoundCommentedIds([]);
      setCompany(initialCompany);
      setPosition(initialPosition);
      setValidationResult(null);
    }
  }, [initialResume, initialCompany, initialPosition, defaultTheme]);

  const setComment = useCallback((sectionId: string, value: string) => {
    setComments((prev) => ({ ...prev, [sectionId]: value }));
  }, []);

  const clearComment = useCallback((sectionId: string) => {
    setComments((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  // Render the themed preview whenever the resume or theme changes.
  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    setIsPreviewLoading(true);

    renderPreview(selectedTheme, resume)
      .then((html) => {
        if (cancelled) return;
        setPreviewHtml(html);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resume, selectedTheme, renderPreview]);

  // Collect non-empty comments as section+comment pairs.
  const pendingComments = useCallback((): SectionComment[] => {
    return Object.entries(comments)
      .filter(([, value]) => value.trim().length > 0)
      .map(([sectionId, comment]) => ({ sectionId, comment }));
  }, [comments]);

  const hasComments = pendingComments().length > 0;

  /**
   * Submit the per-section comments: compile the PII-free French message, send
   * it through the chat loop, and on success apply a DETERMINISTIC
   * section-scoped merge (`mergeScopedResume`) so only the commented sections
   * come from the LLM output — all other sections, all `basics` PII, `meta`, and
   * unknown keys are restored verbatim from the pre-regen resume. The raw LLM
   * `updated` is NEVER applied directly. Comments are cleared and the round
   * advances (AC-7). On error preserve comments and unlock (AC-12). The round
   * diff is computed against the MERGED resume, and the commented ids of this
   * round are exposed via `lastRoundCommentedIds` so the panel can flag no-ops.
   */
  const submitComments = useCallback(async () => {
    const toSend = pendingComments();
    if (toSend.length === 0 || isRegenerating) return;

    setError(null);
    setChanges([]);
    setLastRoundCommentedIds([]);
    // A further regeneration round invalidates any prior successful validation.
    setValidationResult(null);
    setIsRegenerating(true);
    try {
      const message = buildRegenerationMessage(toSend);
      const {
        resume: updated,
        error: err,
        company: roundCompany,
        position: roundPosition,
      } = await sendFeedbackMessage(message);
      if (err) {
        // Preserve comments so the user can retry without re-typing.
        setError(err);
        return;
      }
      if (updated && resume) {
        // Apply the scoped merge — never the raw LLM output. Compute the diff
        // against the merged resume. Merge/diff values are for in-modal display
        // / local application only and never flow into a prompt.
        const merged = mergeScopedResume(resume, updated, toSend);
        setChanges(diffResumes(resume, merged));
        setResume(merged);
        setLastRoundCommentedIds(
          toSend
            .filter((c) => c.comment.trim().length > 0)
            .map((c) => c.sectionId),
        );
      }
      // Retain the LATEST non-empty company/position across rounds (AC-4):
      // only override when the round's result actually supplied one.
      if (roundCompany) setCompany(roundCompany);
      if (roundPosition) setPosition(roundPosition);
      setRound((prev) => prev + 1);
      setComments({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegenerating(false);
    }
  }, [pendingComments, isRegenerating, sendFeedbackMessage, resume]);

  /**
   * Validate: write the final HTML/PDF DETERMINISTICALLY via
   * `resume:generate-final` — no `sendFeedbackMessage`/`ai:chat` call at all
   * (AC-8, AC-12). Three outcomes:
   * - **Blocked**: `company`/`position` empty/blank — sets an inline French
   *   error, makes NO IPC call, does NOT call `onValidated`, stays open and
   *   retryable (AC-9).
   * - **Error**: the IPC call resolves `success: false` or rejects — sets an
   *   inline French error, stays open and retryable (AC-10).
 * - **Success**: calls `onValidated(resume)` (existing persistence
 *   contract) and sets `validationResult` so `FeedbackModal` can render the
 *   success panel + reveal action (AC-11). On a FULL success (both
 *   `htmlPath`/`pdfPath` present, no `error`) it additionally fires
 *   `onFullValidationSuccess` and calls `onClose()` to auto-close the modal;
 *   a PARTIAL success (`pdfPath` absent, `warning` set) does neither and
 *   stays open exactly as before.
   * The existing `isRegenerating` lock guards against rapid/duplicate clicks
   * (AC-18), reused unchanged from the regeneration-round guard.
   */
  const validate = useCallback(async () => {
    if (!resume || isRegenerating) return;

    setError(null);
    setValidationResult(null);

    if (!company?.trim() || !position?.trim()) {
      setError(
        "Impossible de déterminer l'entreprise et le poste pour cette candidature. " +
          "Relancez une proposition de CV (le modèle doit préciser l'entreprise et " +
          "le poste) avant de valider.",
      );
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await window.api.invoke(Channels.RESUME_GENERATE_FINAL, {
        resumeJson: resume,
        company,
        position,
        themeName: selectedTheme,
      });

      if (!response.success) {
        setError(
          response.error ||
            "La génération du CV a échoué. Veuillez réessayer.",
        );
        return;
      }

      onValidated(resume);
      setValidationResult({
        htmlPath: response.htmlPath,
        pdfPath: response.pdfPath,
        warning: response.pdfPath ? undefined : response.error,
      });
      onThemeValidated(selectedTheme);

      if (response.pdfPath && !response.error && response.htmlPath) {
        onFullValidationSuccess?.({
          company,
          position,
          htmlPath: response.htmlPath,
          pdfPath: response.pdfPath,
        });
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegenerating(false);
    }
  }, [
    resume,
    isRegenerating,
    company,
    position,
    selectedTheme,
    onValidated,
    onThemeValidated,
    onFullValidationSuccess,
    onClose,
  ]);

  /**
   * "Reveal in folder": no-ops if there is no successful `validationResult` or
   * neither path is set; otherwise invokes `shell:show-item-in-folder` with
   * the PDF path if present, else the HTML path (AC-14).
   */
  const revealInFolder = useCallback(() => {
    const path = validationResult?.pdfPath ?? validationResult?.htmlPath;
    if (!path) return;
    void window.api.invoke(Channels.SHELL_SHOW_ITEM_IN_FOLDER, { path });
  }, [validationResult]);

  return {
    resume,
    selectedTheme,
    setSelectedTheme,
    comments,
    previewHtml,
    isPreviewLoading,
    isRegenerating,
    round,
    error,
    changes,
    lastRoundCommentedIds,
    hasComments,
    validationResult,
    setComment,
    clearComment,
    submitComments,
    validate,
    revealInFolder,
    close: onClose,
  };
}
