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
    activeTool: null,
    hasComments: false,
    setComment: vi.fn(),
    clearComment: vi.fn(),
    submitComments: vi.fn(),
    validate: vi.fn(),
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
});
