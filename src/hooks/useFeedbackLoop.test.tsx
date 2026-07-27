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
      defaultTheme: "modern-sidebar",
      defaultPageMode: "multi-page" as const,
      initialResume: seedResume,
      sendFeedbackMessage: vi.fn().mockResolvedValue({ resume: null }),
      renderPreview: vi.fn().mockResolvedValue("<div>preview</div>"),
      onValidated: vi.fn(),
      onThemeValidated: vi.fn(),
      onPageModeValidated: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
  }

  it("seeds the resume from initialResume and renders the preview", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useFeedbackLoop(options));
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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
      const onFullValidationSuccess = vi.fn();
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useFeedbackLoop>[0]) =>
          useFeedbackLoop(props),
        {
          initialProps: makeOptions({
            onValidated,
            onClose,
            onFullValidationSuccess,
          }),
        },
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
      // AC-3: no chat message / applications write is triggered on the
      // blocked path — the callback is the only trigger App.tsx uses.
      expect(onFullValidationSuccess).not.toHaveBeenCalled();

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
      const onFullValidationSuccess = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: false, error: "boom" });
        }
        return Promise.resolve({});
      });
      const options = makeOptionsWithCompany({
        onValidated,
        onClose,
        onFullValidationSuccess,
      });
      const { result } = renderHook(() => useFeedbackLoop(options));

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBe("boom");
      expect(onValidated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      // AC-3: no chat message / applications write on the error path.
      expect(onFullValidationSuccess).not.toHaveBeenCalled();
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
      const onFullValidationSuccess = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.reject(new Error("network down"));
        }
        return Promise.resolve({});
      });
      const options = makeOptionsWithCompany({
        onValidated,
        onClose,
        onFullValidationSuccess,
      });
      const { result } = renderHook(() => useFeedbackLoop(options));

      await act(async () => {
        await result.current.validate();
      });

      expect(result.current.error).toBe("network down");
      expect(onValidated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      // AC-3: no chat message / applications write on the rejected path.
      expect(onFullValidationSuccess).not.toHaveBeenCalled();
      expect(result.current.isRegenerating).toBe(false);
    });

    it("Partial success (AC-2): htmlPath only (no pdfPath) does not close the modal or fire onFullValidationSuccess", async () => {
      const onValidated = vi.fn();
      const onClose = vi.fn();
      const onFullValidationSuccess = vi.fn();
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({
            success: true,
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
            error: "La génération du PDF a échoué.",
          });
        }
        return Promise.resolve({});
      });
      const options = makeOptionsWithCompany({
        onValidated,
        onClose,
        onFullValidationSuccess,
      });
      const { result } = renderHook(() => useFeedbackLoop(options));

      await act(async () => {
        await result.current.validate();
      });

      expect(onValidated).toHaveBeenCalledTimes(1);
      // Partial success (no pdfPath): modal stays open, no auto-close, no
      // full-validation callback.
      expect(onClose).not.toHaveBeenCalled();
      expect(onFullValidationSuccess).not.toHaveBeenCalled();
      expect(result.current.validationResult).toEqual({
        htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
        pdfPath: undefined,
        warning: "La génération du PDF a échoué.",
      });
    });

    it("Full success (AC-1, AC-4, AC-11): auto-closes and fires onFullValidationSuccess with company/position/htmlPath/pdfPath", async () => {
      const send = vi.fn().mockResolvedValue({ resume: null });
      const onValidated = vi.fn();
      const onClose = vi.fn();
      const onFullValidationSuccess = vi.fn();
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
      const options = makeOptionsWithCompany({
        sendFeedbackMessage: send,
        onValidated,
        onClose,
        onFullValidationSuccess,
      });
      const { result } = renderHook(() => useFeedbackLoop(options));

      await act(async () => {
        await result.current.validate();
      });

      expect(onValidated).toHaveBeenCalledTimes(1);
      expect(onValidated).toHaveBeenCalledWith(seedResume);
      // A FULL success (both paths present, no error) now auto-closes (AC-1).
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onFullValidationSuccess).toHaveBeenCalledTimes(1);
      expect(onFullValidationSuccess).toHaveBeenCalledWith({
        company: "Doctolib",
        position: "Développeur Fullstack",
        htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
        pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
      });
      expect(result.current.validationResult).toEqual({
        htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
        pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
        warning: undefined,
      });
      // No LLM call during Valider's file-write step (AC-8/AC-12).
      expect(send).not.toHaveBeenCalled();
      expect(api.invoke.mock.calls.some((c) => c[0] === Channels.AI_CHAT)).toBe(
        false,
      );
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
      const options = makeOptionsWithCompany({ sendFeedbackMessage: send });
      const { result } = renderHook(() => useFeedbackLoop(options));

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
      const options = makeOptionsWithCompany({ sendFeedbackMessage: send });
      const { result } = renderHook(() => useFeedbackLoop(options));

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
      const options = makeOptionsWithCompany();
      const { result } = renderHook(() => useFeedbackLoop(options));

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
      const options = makeOptionsWithCompany();
      const { result } = renderHook(() => useFeedbackLoop(options));

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
      const options = makeOptionsWithCompany();
      const { result } = renderHook(() => useFeedbackLoop(options));

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
        (props: Parameters<typeof useFeedbackLoop>[0]) =>
          useFeedbackLoop(props),
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
      await act(async () => {
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
      // Flush the rerender's preview-render effect to avoid an act() warning.
      await waitFor(() => expect(result.current.previewHtml).not.toBe(""));
    });
  });

  it("populates `changes` from the round diff and never forwards diff values into the prompt (AC-11)", async () => {
    const updatedResume: Resume = {
      basics: { summary: "Résumé retravaillé" },
      work: [{ name: "ACME" }],
    };
    const send = vi.fn().mockResolvedValue({ resume: updatedResume });
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

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
    expect(result.current.changes.every((c) => c.sectionId === "work")).toBe(
      true,
    );
    expect(result.current.changes.length).toBeGreaterThan(0);
  });

  it("discards ephemeral comments/round when unmounted and remounted (AC-9)", async () => {
    const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
    const firstOptions = makeOptions({ sendFeedbackMessage: send });
    const { result, unmount } = renderHook(() => useFeedbackLoop(firstOptions));

    act(() => result.current.setComment("work", "un commentaire éphémère"));
    await act(async () => {
      await result.current.submitComments();
    });
    expect(result.current.round).toBe(1);

    // Closing/unmounting the modal drops all ephemeral React state; a fresh
    // mount starts clean (nothing persisted, nothing restored).
    unmount();
    const secondOptions = makeOptions({ sendFeedbackMessage: send });
    const { result: fresh } = renderHook(() => useFeedbackLoop(secondOptions));
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
    const options = makeOptions();
    const { result } = renderHook(() => useFeedbackLoop(options));
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
    const options = makeOptions({ sendFeedbackMessage: send });
    const { result } = renderHook(() => useFeedbackLoop(options));

    act(() => result.current.setComment("work", "change"));
    await act(async () => {
      await result.current.submitComments();
    });

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  describe("modal-local theme selection (ThemePickerRail wiring)", () => {
    it("seeds selectedTheme from defaultTheme on mount", async () => {
      const options = makeOptions({ defaultTheme: "elegant" });
      const { result } = renderHook(() => useFeedbackLoop(options));
      expect(result.current.selectedTheme).toBe("elegant");
      // Flush the initial preview-render effect to avoid an act() warning.
      await waitFor(() => expect(result.current.previewHtml).not.toBe(""));
    });

    it("reseeds the local selectedTheme from defaultTheme on a NEW initialResume, not from a stale local selection (AC-8)", async () => {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useFeedbackLoop>[0]) =>
          useFeedbackLoop(props),
        { initialProps: makeOptions({ defaultTheme: "modern-sidebar" }) },
      );

      // The user picks a different theme locally within the session.
      act(() => result.current.setSelectedTheme("creative"));
      expect(result.current.selectedTheme).toBe("creative");

      const nextResume: Resume = { basics: { summary: "Nouveau CV" } };
      act(() => {
        rerender(
          makeOptions({
            defaultTheme: "professional",
            initialResume: nextResume,
          }),
        );
      });

      // A NEW initialResume reseeds from the NEW defaultTheme, not the stale
      // local selection ("creative") nor the OLD defaultTheme.
      expect(result.current.selectedTheme).toBe("professional");
      // Flush the re-seeded preview-render effect to avoid an act() warning.
      await waitFor(() =>
        expect(result.current.previewHtml).not.toBe(""),
      );
    });

    it("changing defaultTheme alone (no new initialResume) does not change the local selectedTheme (AC-7/AC-8 boundary)", async () => {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useFeedbackLoop>[0]) =>
          useFeedbackLoop(props),
        { initialProps: makeOptions({ defaultTheme: "modern-sidebar" }) },
      );

      act(() => result.current.setSelectedTheme("bold"));
      expect(result.current.selectedTheme).toBe("bold");
      // Flush the theme-switch preview-render effect before rerendering.
      await waitFor(() => expect(result.current.previewHtml).not.toBe(""));

      // Same initialResume reference (seedResume) — only defaultTheme changes.
      await act(async () => {
        rerender(makeOptions({ defaultTheme: "simple" }));
      });

      // The seededRef guard blocks the reseed: the local selection is untouched.
      expect(result.current.selectedTheme).toBe("bold");
    });

    it("setSelectedTheme re-renders the main preview via the injected renderPreview with the new theme + current resume, and does not touch comments/round/changes/lastRoundCommentedIds/validationResult (AC-5, AC-6)", async () => {
      const renderPreview = vi.fn().mockResolvedValue("<div>preview</div>");
      const options = makeOptions({ renderPreview });
      const { result } = renderHook(() => useFeedbackLoop(options));
      await waitFor(() => expect(result.current.previewHtml).not.toBe(""));
      renderPreview.mockClear();
      renderPreview.mockResolvedValue("<div>autre thème</div>");

      act(() => result.current.setComment("work", "un brouillon"));

      act(() => result.current.setSelectedTheme("elegant"));

      await waitFor(() =>
        expect(renderPreview).toHaveBeenCalledWith(
          "elegant",
          seedResume,
          "multi-page",
        ),
      );
      await waitFor(() =>
        expect(result.current.previewHtml).toBe("<div>autre thème</div>"),
      );

      // Unrelated state is untouched by a theme switch.
      expect(result.current.comments).toEqual({ work: "un brouillon" });
      expect(result.current.round).toBe(0);
      expect(result.current.changes).toEqual([]);
      expect(result.current.lastRoundCommentedIds).toEqual([]);
      expect(result.current.validationResult).toBeNull();
    });

    it("validate() sends the CURRENTLY selected local theme (not defaultTheme) as themeName (AC-9)", async () => {
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: true, htmlPath: "/tmp/h.html" });
        }
        return Promise.resolve({});
      });
      const options = makeOptions({
        defaultTheme: "modern-sidebar",
        initialCompany: "Doctolib",
        initialPosition: "Développeur Fullstack",
      });
      const { result } = renderHook(() => useFeedbackLoop(options));

      act(() => result.current.setSelectedTheme("minimal"));
      await waitFor(() => expect(result.current.selectedTheme).toBe("minimal"));

      await act(async () => {
        await result.current.validate();
      });

      const genCall = api.invoke.mock.calls.find(
        (c) => c[0] === Channels.RESUME_GENERATE_FINAL,
      );
      expect(genCall?.[1]).toMatchObject({ themeName: "minimal" });
    });

    it("onThemeValidated fires with the selected theme ONLY on a successful validate() (AC-10, AC-11)", async () => {
      const onThemeValidated = vi.fn();

      // 1) Blocked validate (no company/position): does NOT fire.
      const blockedOptions = makeOptions({ onThemeValidated });
      const { result: blockedResult } = renderHook(() =>
        useFeedbackLoop(blockedOptions),
      );
      await act(async () => {
        await blockedResult.current.validate();
      });
      expect(onThemeValidated).not.toHaveBeenCalled();

      // 2) success:false response: does NOT fire.
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: false, error: "boom" });
        }
        return Promise.resolve({});
      });
      const failedOptions = makeOptions({
        onThemeValidated,
        initialCompany: "Doctolib",
        initialPosition: "Développeur",
      });
      const { result: failedResult } = renderHook(() =>
        useFeedbackLoop(failedOptions),
      );
      await act(async () => {
        await failedResult.current.validate();
      });
      expect(onThemeValidated).not.toHaveBeenCalled();

      // 3) Rejected invoke: does NOT fire.
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.reject(new Error("network down"));
        }
        return Promise.resolve({});
      });
      const rejectedOptions = makeOptions({
        onThemeValidated,
        initialCompany: "Doctolib",
        initialPosition: "Développeur",
      });
      const { result: rejectedResult } = renderHook(() =>
        useFeedbackLoop(rejectedOptions),
      );
      await act(async () => {
        await rejectedResult.current.validate();
      });
      expect(onThemeValidated).not.toHaveBeenCalled();

      // 4) A plain regeneration round (submitComments): does NOT fire.
      const send = vi.fn().mockResolvedValue({ resume: { basics: {} } });
      const regenOptions = makeOptions({
        onThemeValidated,
        sendFeedbackMessage: send,
      });
      const { result: regenResult } = renderHook(() =>
        useFeedbackLoop(regenOptions),
      );
      act(() => regenResult.current.setComment("work", "change"));
      await act(async () => {
        await regenResult.current.submitComments();
      });
      expect(onThemeValidated).not.toHaveBeenCalled();

      // 5) close(): does NOT fire.
      act(() => regenResult.current.close());
      expect(onThemeValidated).not.toHaveBeenCalled();

      // 6) A successful validate() with a locally-switched theme fires with
      // THAT theme (not defaultTheme).
      api.invoke.mockImplementation((channel: string) => {
        if (channel === Channels.RESUME_RENDER_PREVIEW) {
          return Promise.resolve({ html: "<div>preview</div>" });
        }
        if (channel === Channels.RESUME_GENERATE_FINAL) {
          return Promise.resolve({ success: true, htmlPath: "/tmp/h.html" });
        }
        return Promise.resolve({});
      });
      const successOptions = makeOptions({
        onThemeValidated,
        defaultTheme: "modern-sidebar",
        initialCompany: "Doctolib",
        initialPosition: "Développeur",
      });
      const { result: successResult } = renderHook(() =>
        useFeedbackLoop(successOptions),
      );
      act(() => successResult.current.setSelectedTheme("compact"));
      await act(async () => {
        await successResult.current.validate();
      });
      expect(onThemeValidated).toHaveBeenCalledTimes(1);
      expect(onThemeValidated).toHaveBeenCalledWith("compact");
    });

    it("does not write the theme selection to localStorage on a theme switch (AC-7)", async () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const options = makeOptions();
      const { result } = renderHook(() => useFeedbackLoop(options));

      act(() => result.current.setSelectedTheme("bold"));
      await waitFor(() => expect(result.current.selectedTheme).toBe("bold"));

      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });

    it("if renderPreview rejects after a theme switch, sets the existing error state without throwing (AC-14)", async () => {
      const renderPreview = vi
        .fn()
        .mockResolvedValueOnce("<div>preview</div>")
        .mockRejectedValueOnce(new Error("échec du rendu"));
      const options = makeOptions({ renderPreview });
      const { result } = renderHook(() => useFeedbackLoop(options));
      await waitFor(() => expect(result.current.previewHtml).not.toBe(""));

      act(() => result.current.setSelectedTheme("creative"));

      await waitFor(() => expect(result.current.error).toBe("échec du rendu"));
    });
  });
});
