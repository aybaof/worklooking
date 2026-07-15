/**
 * Tier 3 — renderer hook (in-app feedback modal, single-window design). Mocks
 * `window.api` for the themed preview render and a `sendFeedbackMessage`
 * callback (provided by `useChat`) that continues the SAME conversation. The
 * hook never calls `ai:chat` directly. Covers AC-7, AC-11, AC-12, AC-13.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import { Channels } from "@/../shared/ipc";
import {
  buildRegenerationMessage,
  buildValidationMessage,
} from "@/../shared/feedbackMessages";
import type { Resume } from "@/../shared/resume-types";
import { useFeedbackLoop } from "./useFeedbackLoop";

const seedResume: Resume = {
  basics: { summary: "Profil" },
  work: [{ name: "ACME" }],
};

describe("useFeedbackLoop (modal)", () => {
  let api: ReturnType<typeof installMockWindowApi>;

  beforeEach(() => {
    api = installMockWindowApi();
    api.invoke.mockImplementation((channel: string) => {
      if (channel === Channels.RESUME_RENDER_PREVIEW) {
        return Promise.resolve({ html: "<div>preview</div>" });
      }
      return Promise.resolve({});
    });
  });

  function makeOptions(
    overrides: Partial<Parameters<typeof useFeedbackLoop>[0]> = {},
  ) {
    return {
      selectedTheme: "modern-sidebar",
      initialResume: seedResume,
      sendFeedbackMessage: vi.fn().mockResolvedValue({ resume: null }),
      onValidated: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
  }

  it("seeds the resume from initialResume and renders the preview", async () => {
    const { result } = renderHook(() => useFeedbackLoop(makeOptions()));
    expect(result.current.resume).toEqual(seedResume);
    await waitFor(() =>
      expect(result.current.previewHtml).toBe("<div>preview</div>"),
    );
    expect(result.current.round).toBe(0);
  });

  it("submitComments compiles the PII-free French message, replaces resume + clears comments (AC-7)", async () => {
    const updatedResume: Resume = { basics: { summary: "Nouveau" } };
    const send = vi.fn().mockResolvedValue({ resume: updatedResume });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "Résume cette section"));
    await act(async () => {
      await result.current.submitComments();
    });

    expect(send).toHaveBeenCalledWith(
      buildRegenerationMessage([
        { sectionId: "work", comment: "Résume cette section" },
      ]),
    );
    expect(result.current.resume).toEqual(updatedResume);
    expect(result.current.comments).toEqual({});
    expect(result.current.round).toBe(1);
  });

  it("locks while regenerating (AC-6 supporting)", async () => {
    let resolveSend: (v: { resume: Resume | null }) => void = () => {};
    const send = vi.fn(
      (): Promise<{ resume: Resume | null; error?: string }> =>
        new Promise((resolve) => (resolveSend = resolve)),
    );
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "change"));
    let pending: Promise<void>;
    act(() => {
      pending = result.current.submitComments();
    });
    await waitFor(() => expect(result.current.isRegenerating).toBe(true));

    await act(async () => {
      resolveSend({ resume: { basics: {} } });
      await pending;
    });
    expect(result.current.isRegenerating).toBe(false);
  });

  it("surfaces errors, preserves comments and unlocks; retry re-sends (AC-12)", async () => {
    const send = vi.fn().mockResolvedValue({ resume: null, error: "boom" });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "change"));
    await act(async () => {
      await result.current.submitComments();
    });

    expect(result.current.error).toBe("boom");
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.comments).toEqual({ work: "change" });

    await act(async () => {
      await result.current.submitComments();
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("allows many consecutive rounds with no cap (AC-13)", async () => {
    const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    for (let i = 0; i < 5; i++) {
      act(() => result.current.setComment("work", `retour ${i}`));
      await act(async () => {
        await result.current.submitComments();
      });
    }
    expect(result.current.round).toBe(5);
  });

  it("validate sends the French validation message, persists, then closes (AC-9)", async () => {
    const finalResume: Resume = { basics: { summary: "Final" } };
    const send = vi.fn().mockResolvedValue({ resume: finalResume });
    const onValidated = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useFeedbackLoop(
        makeOptions({ sendFeedbackMessage: send, onValidated, onClose }),
      ),
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(send).toHaveBeenCalledWith(buildValidationMessage());
    expect(onValidated).toHaveBeenCalledWith(finalResume);
    expect(onClose).toHaveBeenCalled();
  });

  it("Valider closes reliably: onValidated once + onClose exactly once on success (AC-5)", async () => {
    const finalResume: Resume = { basics: { summary: "Final" } };
    const send = vi.fn().mockResolvedValue({ resume: finalResume });
    const onValidated = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useFeedbackLoop(
        makeOptions({ sendFeedbackMessage: send, onValidated, onClose }),
      ),
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(onValidated).toHaveBeenCalledTimes(1);
    expect(onValidated).toHaveBeenCalledWith(finalResume);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("Valider falls back to the current resume when validation returns no updatedResume (AC-5)", async () => {
    // generate_resume_files may return no resume; onValidated must still fire
    // once with the current resume and onClose exactly once.
    const send = vi.fn().mockResolvedValue({ resume: null });
    const onValidated = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useFeedbackLoop(
        makeOptions({ sendFeedbackMessage: send, onValidated, onClose }),
      ),
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(onValidated).toHaveBeenCalledTimes(1);
    expect(onValidated).toHaveBeenCalledWith(seedResume);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Valider error keeps the modal open, sets error, and is retryable (AC-6)", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ resume: null, error: "provider down" })
      .mockResolvedValueOnce({ resume: { basics: { summary: "OK" } } });
    const onValidated = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useFeedbackLoop(
        makeOptions({ sendFeedbackMessage: send, onValidated, onClose }),
      ),
    );

    // First validate → error path.
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.error).toBe("provider down");
    expect(onClose).not.toHaveBeenCalled();
    expect(onValidated).not.toHaveBeenCalled();
    expect(result.current.isRegenerating).toBe(false);

    // A subsequent validate can be attempted and now succeeds.
    await act(async () => {
      await result.current.validate();
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(onValidated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a returned updatedResume does NOT reopen/re-seed after a successful validate (AC-7)", async () => {
    const updatedResume: Resume = {
      basics: { summary: "Validé et régénéré" },
    };
    const send = vi.fn().mockResolvedValue({ resume: updatedResume });
    const onValidated = vi.fn();
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useFeedbackLoop>[0]) => useFeedbackLoop(props),
      {
        initialProps: makeOptions({
          sendFeedbackMessage: send,
          onValidated,
          onClose,
        }),
      },
    );

    // Add a comment then validate successfully.
    act(() => result.current.setComment("work", "un commentaire"));
    await act(async () => {
      await result.current.validate();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Simulate the parent NOT changing initialResume (validation's updatedResume
    // flows to useResume, not back into feedbackResume). The seededRef guard must
    // prevent any re-seed even if the SAME initialResume reference re-renders.
    act(() => {
      rerender(
        makeOptions({
          sendFeedbackMessage: send,
          onValidated,
          onClose,
          initialResume: seedResume,
        }),
      );
    });

    // No re-seed happened: still one close, comments not wiped by a phantom
    // reseed, round unchanged for the closed instance.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.comments).toEqual({ work: "un commentaire" });
    expect(result.current.round).toBe(0);
  });

  it("populates `changes` from the round diff and never forwards diff values into the prompt (AC-11)", async () => {
    const updatedResume: Resume = {
      basics: { summary: "Résumé retravaillé" },
      work: [{ name: "ACME" }],
    };
    const send = vi.fn().mockResolvedValue({ resume: updatedResume });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "Ajoute des détails"));
    await act(async () => {
      await result.current.submitComments();
    });

    // `changes` exposes the leaf diff between the previous and new resume.
    expect(result.current.changes.length).toBeGreaterThan(0);
    const summaryChange = result.current.changes.find(
      (c) => c.label === "Résumé / Profil",
    );
    expect(summaryChange?.before).toBe("Profil");
    expect(summaryChange?.after).toBe("Résumé retravaillé");

    // PII-safety: the message sent through sendFeedbackMessage contains ONLY the
    // built regeneration message (labels + comments), never any diff VALUE.
    const sentArg = send.mock.calls[0][0] as string;
    expect(sentArg).toBe(
      buildRegenerationMessage([
        { sectionId: "work", comment: "Ajoute des détails" },
      ]),
    );
    expect(sentArg).not.toContain("Résumé retravaillé");
    expect(sentArg).not.toContain("Profil");
  });

  it("discards ephemeral comments/round when unmounted and remounted (AC-9)", async () => {
    const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
    const { result, unmount } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "un commentaire éphémère"));
    await act(async () => {
      await result.current.submitComments();
    });
    expect(result.current.round).toBe(1);

    // Closing/unmounting the modal drops all ephemeral React state; a fresh
    // mount starts clean (nothing persisted, nothing restored).
    unmount();
    const { result: fresh } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );
    await waitFor(() => expect(fresh.current.previewHtml).not.toBe(""));
    expect(fresh.current.comments).toEqual({});
    expect(fresh.current.round).toBe(0);
    expect(fresh.current.error).toBeNull();
  });

  it("re-seeds and clears comments when a new initialResume opens the modal (AC-6/AC-9)", async () => {
    const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useFeedbackLoop>[0]) => useFeedbackLoop(props),
      { initialProps: makeOptions({ sendFeedbackMessage: send }) },
    );
    // Flush the initial preview-render effect.
    await waitFor(() => expect(result.current.previewHtml).not.toBe(""));

    act(() => result.current.setComment("work", "brouillon"));
    expect(result.current.comments).toEqual({ work: "brouillon" });

    const nextResume: Resume = { basics: { summary: "Nouveau CV" } };
    act(() => {
      rerender(
        makeOptions({ sendFeedbackMessage: send, initialResume: nextResume }),
      );
    });

    expect(result.current.resume).toEqual(nextResume);
    expect(result.current.comments).toEqual({});
    expect(result.current.round).toBe(0);
    // Flush the re-seeded preview render.
    await waitFor(() => expect(result.current.resume).toEqual(nextResume));
  });

  it("hasComments is false with no comments and true once a comment is set (empty-comments edge)", async () => {
    const { result } = renderHook(() => useFeedbackLoop(makeOptions()));
    // Flush the initial preview-render effect.
    await waitFor(() => expect(result.current.previewHtml).not.toBe(""));
    expect(result.current.hasComments).toBe(false);

    act(() => result.current.setComment("work", "   "));
    expect(result.current.hasComments).toBe(false); // blank-only ignored

    act(() => result.current.setComment("work", "vrai commentaire"));
    expect(result.current.hasComments).toBe(true);
  });

  it("does not write to localStorage (AC-11)", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "change"));
    await act(async () => {
      await result.current.submitComments();
    });

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
