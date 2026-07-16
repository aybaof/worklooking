/**
 * Tier 3 — renderer component. Pure-presentation modal for the in-app CV
 * feedback loop (single-window design). Covers AC-2 (per-section comment UI for
 * every present section + themed preview surface), the empty-comments edge case
 * (Régénérer disabled with zero comments), and AC-12 (French copy).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { Resume } from "@/../shared/resume-types";
import { RESUME_SECTIONS } from "@/../shared/resume-sections";
import { FeedbackModal } from "./FeedbackModal";

// A resume with content in every JSON Resume section so the rail renders a pin
// for each one (AC-2).
const fullResume: Resume = {
  basics: { name: "Jean Dupont", summary: "Développeur" },
  work: [{ name: "ACME" }],
  education: [{ institution: "Université" }],
  skills: [{ name: "TypeScript" }],
  projects: [{ name: "Projet" }],
  awards: [{ title: "Prix" }],
  languages: [{ language: "Français" }],
  volunteer: [{ organization: "Assoc" }],
  publications: [{ name: "Article" }],
  references: [{ name: "Référent" }],
  interests: [{ name: "Échecs" }],
};

function baseProps(overrides: Partial<Parameters<typeof FeedbackModal>[0]> = {}) {
  return {
    resume: fullResume,
    comments: {},
    previewHtml: "<div>aperçu</div>",
    isPreviewLoading: false,
    isRegenerating: false,
    round: 0,
    error: null,
    changes: [],
    commentedSectionIds: [],
    activeTool: null,
    hasComments: false,
    validationResult: null,
    selectedTheme: "modern-sidebar",
    availableThemes: [
      { id: "modern-sidebar", label: "Modern Sidebar", description: "" },
      { id: "professional", label: "Professional", description: "" },
    ],
    onSelectTheme: vi.fn(),
    renderThemePreview: vi.fn().mockResolvedValue("<div>aperçu</div>"),
    setComment: vi.fn(),
    clearComment: vi.fn(),
    submitComments: vi.fn(),
    validate: vi.fn(),
    onRevealInFolder: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("FeedbackModal", () => {
  it("renders a comment pin for every present JSON Resume section (AC-2)", () => {
    render(<FeedbackModal {...baseProps()} />);

    for (const section of RESUME_SECTIONS) {
      expect(screen.getByText(section.label)).not.toBeNull();
    }
  });

  it("renders French copy for the header and actions (AC-12)", () => {
    render(<FeedbackModal {...baseProps()} />);

    expect(screen.getByText("Retours sur le CV")).not.toBeNull();
    expect(
      screen.getByText(/Commentez chaque section puis régénérez/),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: /Régénérer/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Valider/ })).not.toBeNull();
  });

  it("disables Régénérer when there are no comments (empty-comments edge)", () => {
    render(<FeedbackModal {...baseProps({ hasComments: false })} />);
    const regenerate = screen.getByRole("button", { name: /Régénérer/ });
    expect(regenerate.hasAttribute("disabled")).toBe(true);
  });

  it("enables Régénérer and fires submitComments when comments exist", () => {
    const submitComments = vi.fn();
    render(
      <FeedbackModal {...baseProps({ hasComments: true, submitComments })} />,
    );
    const regenerate = screen.getByRole("button", { name: /Régénérer/ });
    expect(regenerate.hasAttribute("disabled")).toBe(false);

    fireEvent.click(regenerate);
    expect(submitComments).toHaveBeenCalled();
  });

  it("opens a French comment editor for a clicked section and records input (AC-2)", () => {
    const setComment = vi.fn();
    render(<FeedbackModal {...baseProps({ setComment })} />);

    fireEvent.click(screen.getByText("Expérience professionnelle"));

    // The popover for the section appears with French copy.
    expect(
      screen.getByText(/Commentaire — Expérience professionnelle/),
    ).not.toBeNull();

    const textarea = screen.getByPlaceholderText(
      /Décrivez ce que vous souhaitez modifier/,
    );
    fireEvent.change(textarea, { target: { value: "Résume cette section" } });
    expect(setComment).toHaveBeenCalledWith("work", "Résume cette section");
  });

  it("locks inputs and shows French progress while regenerating (AC-5)", () => {
    render(
      <FeedbackModal
        {...baseProps({
          isRegenerating: true,
          hasComments: true,
          activeTool: { name: "generate_resume_files", status: "in_progress" },
        })}
      />,
    );

    expect(screen.getByText(/Régénération en cours/)).not.toBeNull();
    expect(screen.getByText(/Utilisation de l'outil/)).not.toBeNull();
    // Both actions are disabled during regeneration.
    expect(
      screen.getByRole("button", { name: /Régénérer/ }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /Valider/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("surfaces a French error banner and preserves the retry hint (AC-10/AC-12)", () => {
    render(
      <FeedbackModal
        {...baseProps({ error: "Le fournisseur est indisponible", hasComments: true })}
      />,
    );

    expect(screen.getByText("Une erreur est survenue")).not.toBeNull();
    expect(screen.getByText("Le fournisseur est indisponible")).not.toBeNull();
    expect(
      screen.getByText(/Vos commentaires ont été conservés/),
    ).not.toBeNull();
    // Inputs unlocked on error so the user can retry.
    expect(
      screen.getByRole("button", { name: /Régénérer/ }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("only renders pins for sections present in the resume (missing-section edge)", () => {
    const sparse: Resume = { basics: { summary: "Profil" }, work: [{ name: "ACME" }] };
    render(<FeedbackModal {...baseProps({ resume: sparse })} />);

    const rail = screen.getByText("Sections du CV").parentElement as HTMLElement;
    expect(within(rail).getByText("Résumé / Profil")).not.toBeNull();
    expect(within(rail).getByText("Expérience professionnelle")).not.toBeNull();
    expect(within(rail).queryByText("Formation")).toBeNull();
    expect(within(rail).queryByText("Compétences")).toBeNull();
  });

  it("renders nothing when there is no resume", () => {
    const { container } = render(
      <FeedbackModal {...baseProps({ resume: null })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses an edge-to-edge overlay with no p-4 margin nor size cap (AC-8)", () => {
    const { container } = render(<FeedbackModal {...baseProps()} />);

    const overlay = container.firstChild as HTMLElement;
    const overlayClasses = overlay.className;
    // Full-viewport overlay, no outer p-4 padding margin.
    expect(overlayClasses).toContain("fixed");
    expect(overlayClasses).toContain("inset-0");
    expect(overlayClasses.split(/\s+/)).not.toContain("p-4");

    // The inner container fills width + height and drops the size cap.
    const inner = overlay.firstElementChild as HTMLElement;
    const innerClasses = inner.className.split(/\s+/);
    expect(innerClasses).toContain("h-full");
    expect(innerClasses).toContain("w-full");
    expect(innerClasses).not.toContain("h-[90vh]");
    expect(innerClasses).not.toContain("w-[95vw]");
    expect(innerClasses).not.toContain("max-w-6xl");

    // Header, rail and preview remain present (non-overlapping structure).
    expect(screen.getByText("Retours sur le CV")).not.toBeNull();
    expect(screen.getByText("Sections du CV")).not.toBeNull();
  });

  it("shows the collapsible diff panel with labels + before→after after round > 0 (AC-11)", () => {
    render(
      <FeedbackModal
        {...baseProps({
          round: 1,
          changes: [
            {
              label: "Expérience professionnelle #1 — Poste",
              sectionId: "work",
              sectionLabel: "Expérience professionnelle",
              before: "Ancien",
              after: "Nouveau",
            },
          ],
        })}
      />,
    );

    const panel = screen.getByTestId("round-diff-panel");
    expect(panel).not.toBeNull();
    expect(
      within(panel).getByText("Expérience professionnelle #1 — Poste"),
    ).not.toBeNull();
    expect(within(panel).getByText("Ancien")).not.toBeNull();
    expect(within(panel).getByText("Nouveau")).not.toBeNull();
  });

  it("shows the French 'no changes' message when the round produced no diff (AC-11)", () => {
    render(<FeedbackModal {...baseProps({ round: 1, changes: [] })} />);

    const panel = screen.getByTestId("round-diff-panel");
    expect(
      within(panel).getByText(/Aucune modification détectée pour ce tour/),
    ).not.toBeNull();
  });

  it("does not show the diff panel before any regeneration round (AC-11)", () => {
    render(<FeedbackModal {...baseProps({ round: 0 })} />);
    expect(screen.queryByTestId("round-diff-panel")).toBeNull();
  });

  it("prompts before closing (X) when there are pending comments; confirm closes (AC-12/AC-14)", () => {
    const onClose = vi.fn();
    render(
      <FeedbackModal {...baseProps({ hasComments: true, onClose })} />,
    );

    // No confirmation yet.
    expect(screen.queryByTestId("unsaved-comments-confirm")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    // In-app confirmation (NOT window.confirm) appears; onClose not yet called.
    const confirm = screen.getByTestId("unsaved-comments-confirm");
    expect(confirm).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Confirming closes.
    fireEvent.click(
      within(confirm).getByRole("button", { name: /Fermer quand même/ }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prompts before closing on Escape when there are pending comments (AC-12)", () => {
    const onClose = vi.fn();
    render(<FeedbackModal {...baseProps({ hasComments: true, onClose })} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByTestId("unsaved-comments-confirm")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancelling the close guard keeps the modal open and comments intact (AC-12)", () => {
    const onClose = vi.fn();
    const setComment = vi.fn();
    const clearComment = vi.fn();
    render(
      <FeedbackModal
        {...baseProps({
          hasComments: true,
          comments: { work: "mon commentaire" },
          onClose,
          setComment,
          clearComment,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    const confirm = screen.getByTestId("unsaved-comments-confirm");
    fireEvent.click(within(confirm).getByRole("button", { name: "Annuler" }));

    // Modal stays open, onClose not called, comments untouched (no clear).
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId("unsaved-comments-confirm")).toBeNull();
    expect(screen.getByText("Retours sur le CV")).not.toBeNull();
    expect(clearComment).not.toHaveBeenCalled();
  });

  it("closes immediately (no confirmation) when there are no pending comments (AC-12)", () => {
    const onClose = vi.fn();
    render(<FeedbackModal {...baseProps({ hasComments: false, onClose })} />);

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(screen.queryByTestId("unsaved-comments-confirm")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prompts before Valider when there are pending comments; confirm validates (AC-13)", () => {
    const validate = vi.fn();
    render(<FeedbackModal {...baseProps({ hasComments: true, validate })} />);

    fireEvent.click(screen.getByRole("button", { name: /Valider/ }));

    const confirm = screen.getByTestId("unsaved-comments-confirm");
    expect(confirm).not.toBeNull();
    // Not validated until confirmed.
    expect(validate).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", { name: /Valider quand même/ }),
    );
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("cancelling the Valider guard aborts validation and keeps comments (AC-13)", () => {
    const validate = vi.fn();
    render(<FeedbackModal {...baseProps({ hasComments: true, validate })} />);

    fireEvent.click(screen.getByRole("button", { name: /Valider/ }));
    const confirm = screen.getByTestId("unsaved-comments-confirm");
    fireEvent.click(within(confirm).getByRole("button", { name: "Annuler" }));

    expect(validate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("unsaved-comments-confirm")).toBeNull();
  });

  it("validates immediately (no confirmation) when there are no pending comments (AC-13)", () => {
    const validate = vi.fn();
    render(<FeedbackModal {...baseProps({ hasComments: false, validate })} />);

    fireEvent.click(screen.getByRole("button", { name: /Valider/ }));

    expect(screen.queryByTestId("unsaved-comments-confirm")).toBeNull();
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("renders the ValidationSuccessPanel with the given paths when validationResult is set (AC-14)", () => {
    render(
      <FeedbackModal
        {...baseProps({
          validationResult: {
            htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
            pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
          },
        })}
      />,
    );

    const panel = screen.getByTestId("validation-success-panel");
    expect(panel).not.toBeNull();
    // The path is a bare text node next to the "HTML :"/"PDF :" label <span>,
    // so no single node's EXACT text equals just the path — substring match.
    expect(
      within(panel).getByText("/tmp/candidatures/doctolib_dev/resume.html", {
        exact: false,
      }),
    ).not.toBeNull();
    expect(
      within(panel).getByText("/tmp/candidatures/doctolib_dev/resume.pdf", {
        exact: false,
      }),
    ).not.toBeNull();
  });

  it("does not render the ValidationSuccessPanel when validationResult is null", () => {
    render(<FeedbackModal {...baseProps({ validationResult: null })} />);
    expect(screen.queryByTestId("validation-success-panel")).toBeNull();
  });

  it("clicking 'Afficher dans le dossier' calls onRevealInFolder (AC-14)", () => {
    const onRevealInFolder = vi.fn();
    render(
      <FeedbackModal
        {...baseProps({
          validationResult: { htmlPath: "/tmp/resume.html" },
          onRevealInFolder,
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Afficher dans le dossier/ }),
    );
    expect(onRevealInFolder).toHaveBeenCalledTimes(1);
  });

  it("shows the amber warning text when validationResult.warning is set", () => {
    render(
      <FeedbackModal
        {...baseProps({
          validationResult: {
            htmlPath: "/tmp/resume.html",
            warning: "La génération du PDF a échoué.",
          },
        })}
      />,
    );

    expect(
      screen.getByText("La génération du PDF a échoué."),
    ).not.toBeNull();
  });

  it("uses an in-app confirmation element, not window.confirm (AC-14)", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<FeedbackModal {...baseProps({ hasComments: true })} />);

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    // The confirmation is a DOM element with role=alertdialog, and the native
    // window.confirm was never invoked.
    const confirm = screen.getByTestId("unsaved-comments-confirm");
    expect(confirm.getAttribute("role")).toBe("alertdialog");
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("renders the theme-picker toggle near RegenControls without displacing the existing rail elements (AC-1)", () => {
    render(<FeedbackModal {...baseProps()} />);

    // Existing rail elements remain present, none removed/reordered.
    expect(screen.getByText("Sections du CV")).not.toBeNull();
    expect(screen.getByText(/Thème :/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Régénérer/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Valider/ })).not.toBeNull();
  });

  it("theme toggle label reflects the selectedTheme prop (AC-2)", () => {
    render(
      <FeedbackModal {...baseProps({ selectedTheme: "professional" })} />,
    );

    expect(screen.getByText("Thème : Professional")).not.toBeNull();
  });

  it("clicking a thumbnail in the expanded grid calls onSelectTheme (AC-5)", async () => {
    const onSelectTheme = vi.fn();
    render(<FeedbackModal {...baseProps({ onSelectTheme })} />);

    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));
    await screen.findByText("Professional");

    fireEvent.click(screen.getByText("Professional"));
    expect(onSelectTheme).toHaveBeenCalledWith("professional");
  });

  it("theme toggle is disabled when isRegenerating is true (AC-12)", () => {
    render(<FeedbackModal {...baseProps({ isRegenerating: true })} />);

    const toggle = screen.getByText("Thème : Modern Sidebar").closest("button");
    expect(toggle?.hasAttribute("disabled")).toBe(true);
  });
});
