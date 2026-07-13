import { useState, useEffect, useCallback } from "react";
import { Channels } from "@/../shared/ipc";
import { Resume } from "@/../shared/resume-types";
import {
  SectionComment,
  buildRegenerationMessage,
  buildValidationMessage,
} from "@/../shared/feedbackMessages";

interface UseFeedbackLoopOptions {
  /** Selected theme used for the themed preview render. */
  selectedTheme: string;
  /**
   * The tailored resume that opened the loop, or `null` when the modal is
   * closed. Changing this to a new resume (re)seeds the loop.
   */
  initialResume: Resume | null;
  /**
   * Continue the SAME chat conversation with a feedback message and return the
   * new tailored resume (provided by `useChat` — the loop runs in the main
   * window, not a second BrowserWindow).
   */
  sendFeedbackMessage: (
    content: string,
  ) => Promise<{ resume: Resume | null; error?: string }>;
  /** Persist the validated resume (existing `useResume` auto-save owner). */
  onValidated: (resume: Resume) => void;
  /** Close the modal. */
  onClose: () => void;
}

/**
 * Owns the CV feedback-loop logic (hooks-own-logic rule). The loop runs INSIDE
 * the main window as a modal overlay (single-window design — the earlier
 * second-`BrowserWindow` approach was dropped as it was unreliable). The hook
 * holds ephemeral draft comments + the current tailored resume + rendered
 * preview, and drives regeneration/validation by continuing the SAME chat
 * conversation via `sendFeedbackMessage`.
 *
 * - `initialResume` seeds the resume when the modal opens.
 * - `submitComments` compiles the PII-free French message, sends it through the
 *   chat loop, and on success replaces the resume + clears comments (AC-7);
 *   on error preserves comments and unlocks (AC-12).
 * - `validate` sends the French validation message (triggers
 *   `generate_resume_files`), persists the resume, then closes the modal.
 * - No `localStorage` / disk persistence of loop state (AC-11).
 */
export function useFeedbackLoop({
  selectedTheme,
  initialResume,
  sendFeedbackMessage,
  onValidated,
  onClose,
}: UseFeedbackLoopOptions) {
  const [resume, setResume] = useState<Resume | null>(initialResume);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reseed the loop whenever a new tailored resume opens the modal.
  useEffect(() => {
    if (initialResume) {
      setResume(initialResume);
      setComments({});
      setRound(0);
      setError(null);
    }
  }, [initialResume]);

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

    window.api
      .invoke(Channels.RESUME_RENDER_PREVIEW, {
        resumeJson: resume,
        themeName: selectedTheme,
      })
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          setError(response.error);
          setPreviewHtml("");
        } else {
          setPreviewHtml(response.html || "");
        }
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
  }, [resume, selectedTheme]);

  // Collect non-empty comments as section+comment pairs.
  const pendingComments = useCallback((): SectionComment[] => {
    return Object.entries(comments)
      .filter(([, value]) => value.trim().length > 0)
      .map(([sectionId, comment]) => ({ sectionId, comment }));
  }, [comments]);

  const hasComments = pendingComments().length > 0;

  /**
   * Submit the per-section comments: compile the PII-free French message, send
   * it through the chat loop, and on success replace the resume + clear comments
   * (AC-7) and advance the round. On error preserve comments and unlock (AC-12).
   */
  const submitComments = useCallback(async () => {
    const toSend = pendingComments();
    if (toSend.length === 0 || isRegenerating) return;

    setError(null);
    setIsRegenerating(true);
    try {
      const message = buildRegenerationMessage(toSend);
      const { resume: updated, error: err } = await sendFeedbackMessage(message);
      if (err) {
        // Preserve comments so the user can retry without re-typing.
        setError(err);
        return;
      }
      if (updated) {
        setResume(updated);
      }
      setRound((prev) => prev + 1);
      setComments({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegenerating(false);
    }
  }, [pendingComments, isRegenerating, sendFeedbackMessage]);

  /**
   * Validate: send the French validation message (triggers
   * `generate_resume_files`), persist the resume, then close the modal (AC-9).
   * Retryable on error — the modal stays open.
   */
  const validate = useCallback(async () => {
    if (!resume || isRegenerating) return;

    setError(null);
    setIsRegenerating(true);
    try {
      const message = buildValidationMessage();
      const { resume: updated, error: err } = await sendFeedbackMessage(message);
      if (err) {
        setError(err);
        return;
      }
      onValidated(updated ?? resume);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegenerating(false);
    }
  }, [resume, isRegenerating, sendFeedbackMessage, onValidated, onClose]);

  return {
    resume,
    comments,
    previewHtml,
    isPreviewLoading,
    isRegenerating,
    round,
    error,
    hasComments,
    setComment,
    clearComment,
    submitComments,
    validate,
    close: onClose,
  };
}
