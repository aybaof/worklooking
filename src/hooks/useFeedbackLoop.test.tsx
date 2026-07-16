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
import { buildRegenerationMessage } from "@/../shared/feedbackMessages";
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

  it("submitComments compiles the PII-free French message, applies the scoped merge + clears comments (AC-7)", async () => {
    // The LLM returns a full resume; only the commented `work` section is taken
    // from it, `basics` (PII) is restored verbatim from the pre-regen resume.
    const updatedResume: Resume = {
      basics: { summary: "Piraté" },
      work: [{ name: "ACME", position: "Ingénieur" }],
    };
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
    // Commented section comes from the LLM; basics (not commented) stays as seed.
    expect(result.current.resume).toEqual({
      basics: { summary: "Profil" },
      work: [{ name: "ACME", position: "Ingénieur" }],
    });
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

  describe("validate() — deterministic resume:generate-final flow", () => {
    function makeOptionsWithCompany(
      overrides: Partial<Parameters<typeof useFeedbackLoop>[0]> = {},
    ) {
      return makeOptions({
        initialCompany: "Doctolib",
        initialPosition: "Développeur Fullstack",
        ...overrides,
      });
    }

    it("Blocked (AC-9): missing company/position sets an inline error, makes no IPC call, and does not call onValidated", async () => {
      const onValidated = vi.fn();
      const onClose = vi.fn();
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useFeedbackLoop>[0]) => useFeedbackLoop(props),
        { initialProps: makeOptions({ onValidated, onClose }) },
      );

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBeTruthy();
      expect(
        api.invoke.mock.calls.some(
          (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
        ),
      ).toBe(false);
      expect(onValidated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      // Retryable: once a fresh tailoring turn supplies company/position (a new
      // initialResume, since the hook only reseeds company/position alongside a
      // NEW initialResume reference), Valider can succeed.
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({
            success: true,
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
            pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
          });
        }
        return Promise.resolve({});
      });

      const nextResume: Resume = { basics: { summary: "Reproposé" } };
      act(() => {
        rerender(
          makeOptions({
            onValidated,
            onClose,
            initialResume: nextResume,
            initialCompany: "Doctolib",
            initialPosition: "Développeur Fullstack",
          }),
        );
      });

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBeNull();
      expect(onValidated).toHaveBeenCalledTimes(1);
      expect(onValidated).toHaveBeenCalledWith(nextResume);
    });

    it("IPC error (AC-10): success:false response sets an inline error, stays retryable", async () => {
      const onValidated = vi.fn();
      const onClose = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: false, error: "boom" });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(makeOptionsWithCompany({ onValidated, onClose })),
      );

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBe("boom");
      expect(onValidated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.isRegenerating).toBe(false);

      // A subsequent call is possible without remounting.
      await act(async () => {
        await result.current.validate();
      });
      const genCalls = api.invoke.mock.calls.filter(
        (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
      );
      expect(genCalls.length).toBe(2);
    });

    it("IPC error (AC-10): a rejected invoke also sets an inline error and stays retryable", async () => {
      const onValidated = vi.fn();
      const onClose = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.reject(new Error("network down"));
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(makeOptionsWithCompany({ onValidated, onClose })),
      );

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBe("network down");
      expect(onValidated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.isRegenerating).toBe(false);
    });

    it("Success (AC-11, AC-12): onValidated fires, onClose does NOT fire, validationResult is set, and no ai:chat call occurs", async () => {
      const send = vi.fn().mockResolvedValue({ resume: null });
      const onValidated = vi.fn();
      const onClose = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({
            success: true,
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
            pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
          });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(
          makeOptionsWithCompany({
            sendFeedbackMessage: send,
            onValidated,
            onClose,
          }),
        ),
      );

      await act(async () => {
        await result.current.validate();
      });

      expect(onValidated).toHaveBeenCalledTimes(1);
      expect(onValidated).toHaveBeenCalledWith(seedResume);
      // Modal close is now a distinct user-initiated action.
      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.validationResult).toEqual({
        htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
        pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
        warning: undefined,
      });
      // No LLM call during Valider's file-write step (AC-8/AC-12).
      expect(send).not.toHaveBeenCalled();
      expect(
        api.invoke.mock.calls.some((c) => c[0] === Channels.AI_CHAT),
      ).toBe(false);

      // A distinct close action is available and functional afterward.
      act(() => result.current.close());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Company/position retained across rounds (AC-4): a round that omits them keeps the initial values", async () => {
      const send = vi
        .fn()
        .mockResolvedValue({ resume: { basics: { summary: "R2" } } }); // no company/position
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: true, htmlPath: "/tmp/h.html" });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(
          makeOptionsWithCompany({ sendFeedbackMessage: send }),
        ),
      );

      act(() => result.current.setComment("work", "change"));
      await act(async () => {
        await result.current.submitComments();
      });

      await act(async () => {
        await result.current.validate();
      });

      const genCall = api.invoke.mock.calls.find(
        (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
      );
      expect(genCall?.[1]).toMatchObject({
        company: "Doctolib",
        position: "Développeur Fullstack",
      });
    });

    it("Company/position retained across rounds (AC-4): a round that supplies new values overrides them", async () => {
      const send = vi.fn().mockResolvedValue({
        resume: { basics: { summary: "R2" } },
        company: "AutreEntreprise",
        position: "Lead Dev",
      });
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: true, htmlPath: "/tmp/h.html" });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(
          makeOptionsWithCompany({ sendFeedbackMessage: send }),
        ),
      );

      act(() => result.current.setComment("work", "change"));
      await act(async () => {
        await result.current.submitComments();
      });

      await act(async () => {
        await result.current.validate();
      });

      const genCall = api.invoke.mock.calls.find(
        (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
      );
      expect(genCall?.[1]).toMatchObject({
        company: "AutreEntreprise",
        position: "Lead Dev",
      });
    });

    it("Rapid double-click guard (AC-18): calling validate() twice without awaiting only invokes RESUME_GENERATE_FINAL once", async () => {
      let resolveInvoke: (v: unknown) => void = () => {};
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return new Promise((resolve) => (resolveInvoke = resolve));
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(makeOptionsWithCompany()),
      );

      // First call: runs synchronously up to the `await window.api.invoke(...)`
      // (setting isRegenerating(true) before suspending), then this act() flushes
      // that state update — mirroring the existing `isRegenerating` guard test's
      // pattern ("locks while regenerating" above) so `result.current.validate`
      // reflects the NEW render (isRegenerating: true) for the second call below.
      let first: Promise<void>;
      act(() => {
        first = result.current.validate();
      });
      await waitFor(() => expect(result.current.isRegenerating).toBe(true));

      // Second call while the first is still in flight: the guard's
      // `isRegenerating` check now sees `true` and must no-op immediately.
      let second: Promise<void>;
      act(() => {
        second = result.current.validate();
      });

      await act(async () => {
        resolveInvoke({ success: true, htmlPath: "/tmp/h.html" });
        await Promise.all([first, second]);
      });

      const genCalls = api.invoke.mock.calls.filter(
        (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
      );
      expect(genCalls.length).toBe(1);
    });

    it("revealInFolder (AC-14): invokes with the HTML path when only HTML is present", async () => {
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({
            success: true,
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
          });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(makeOptionsWithCompany()),
      );

      await act(async () => {
        await result.current.validate();
      });

      act(() => result.current.revealInFolder());

      const revealCall = api.invoke.mock.calls.find(
        (c) => c[0] === Channels.SHELL_SHOW_ITEM_IN_FOLDER,
      );
      expect(revealCall?.[1]).toEqual({
        path: "/tmp/candidatures/doctolib_dev/resume.html",
      });
    });

    it("revealInFolder (AC-14): invokes with the PDF path when both paths are present", async () => {
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({
            success: true,
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
            pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
          });
        }
        return Promise.resolve({});
      });
      const { result } = renderHook(() =>
        useFeedbackLoop(makeOptionsWithCompany()),
      );

      await act(async () => {
        await result.current.validate();
      });

      act(() => result.current.revealInFolder());

      const revealCall = api.invoke.mock.calls.find(
        (c) => c[0] === Channels.SHELL_SHOW_ITEM_IN_FOLDER,
      );
      expect(revealCall?.[1]).toEqual({
        path: "/tmp/candidatures/doctolib_dev/resume.pdf",
      });
    });

    it("a successful validate() does NOT reopen/re-seed the modal on an unrelated rerender (AC-7 regression)", async () => {
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: true, htmlPath: "/tmp/h.html" });
        }
        return Promise.resolve({});
      });
      const onValidated = vi.fn();
      const onClose = vi.fn();
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useFeedbackLoop>[0]) => useFeedbackLoop(props),
        {
          initialProps: makeOptionsWithCompany({ onValidated, onClose }),
        },
      );

      act(() => result.current.setComment("work", "un commentaire"));
      await act(async () => {
        await result.current.validate();
      });
      expect(onValidated).toHaveBeenCalledTimes(1);
      expect(result.current.validationResult).not.toBeNull();

      // Same initialResume reference re-renders (parent did not change it): the
      // seededRef guard must prevent any re-seed / validationResult reset.
      act(() => {
        rerender(
          makeOptionsWithCompany({
            onValidated,
            onClose,
            initialResume: seedResume,
          }),
        );
      });

      expect(result.current.comments).toEqual({ work: "un commentaire" });
      expect(result.current.round).toBe(0);
      expect(result.current.validationResult).not.toBeNull();
    });
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

    // Comment on `summary` so basics.summary (the commented field) flows through
    // the scoped merge and the diff picks it up.
    act(() => result.current.setComment("summary", "Ajoute des détails"));
    await act(async () => {
      await result.current.submitComments();
    });

    // `changes` exposes the leaf diff between the previous and merged resume.
    expect(result.current.changes.length).toBeGreaterThan(0);
    const summaryChange = result.current.changes.find(
      (c) => c.label === "Résumé / Profil",
    );
    expect(summaryChange?.before).toBe("Profil");
    expect(summaryChange?.after).toBe("Résumé retravaillé");
    // The commented ids for this round are exposed for the no-op indicator.
    expect(result.current.lastRoundCommentedIds).toEqual(["summary"]);

    // PII-safety: the message sent through sendFeedbackMessage contains ONLY the
    // built regeneration message (labels + comments), never any diff VALUE.
    const sentArg = send.mock.calls[0][0] as string;
    expect(sentArg).toBe(
      buildRegenerationMessage([
        { sectionId: "summary", comment: "Ajoute des détails" },
      ]),
    );
    expect(sentArg).not.toContain("Résumé retravaillé");
  });

  it("computes the round diff against the MERGED resume, not the raw LLM output (AC-7)", async () => {
    // The LLM alters BOTH the commented `work` section and the NON-commented
    // `basics.summary`. Only `work` is in scope, so the merge must drop the
    // summary change and the diff (computed against the merged resume) must
    // contain ONLY the work change — never the raw-LLM summary edit.
    const updatedResume: Resume = {
      basics: { summary: "DÉRIVE NON DEMANDÉE" },
      work: [{ name: "ACME", position: "Ingénieur" }],
    };
    const send = vi.fn().mockResolvedValue({ resume: updatedResume });
    const { result } = renderHook(() =>
      useFeedbackLoop(makeOptions({ sendFeedbackMessage: send })),
    );

    act(() => result.current.setComment("work", "Ajoute le poste"));
    await act(async () => {
      await result.current.submitComments();
    });

    // Applied resume = scoped merge: work from LLM, basics.summary restored.
    expect(result.current.resume).toEqual({
      basics: { summary: "Profil" },
      work: [{ name: "ACME", position: "Ingénieur" }],
    });
    // Diff is against the merged resume: the non-commented summary drift is
    // absent; no change references the raw LLM summary value.
    const summaryDrift = result.current.changes.find(
      (c) => c.after === "DÉRIVE NON DEMANDÉE",
    );
    expect(summaryDrift).toBeUndefined();
    expect(
      result.current.changes.every((c) => c.sectionId === "work"),
    ).toBe(true);
    expect(result.current.changes.length).toBeGreaterThan(0);
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
