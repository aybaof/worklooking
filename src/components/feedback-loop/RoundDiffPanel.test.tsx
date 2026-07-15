/**
 * Renderer test for the grouped round-diff panel. Covers grouping changes under
 * their section headers and the French "no change" indicator for a commented
 * section that produced no diff entry (LLM no-op). Renderer/jsdom project.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ResumeFieldChange } from "@/../shared/resumeDiff";
import { RoundDiffPanel } from "./RoundDiffPanel";

describe("RoundDiffPanel", () => {
  it("keeps the testid and the round header", () => {
    render(
      <RoundDiffPanel round={3} changes={[]} commentedSectionIds={[]} />,
    );
    expect(screen.getByTestId("round-diff-panel")).not.toBeNull();
    expect(screen.getByText(/Modifications du tour n° 3/)).not.toBeNull();
  });

  it("groups changes under distinct section headers (AC-8)", () => {
    const changes: ResumeFieldChange[] = [
      {
        label: "Expérience professionnelle #1 — Poste",
        sectionId: "work",
        sectionLabel: "Expérience professionnelle",
        before: "Ancien",
        after: "Nouveau",
      },
      {
        label: "Compétences #1 — Niveau",
        sectionId: "skills",
        sectionLabel: "Compétences",
        before: "Débutant",
        after: "Expert",
      },
    ];
    const panel = render(
      <RoundDiffPanel
        round={1}
        changes={changes}
        commentedSectionIds={["work", "skills"]}
      />,
    ).container;

    const scope = within(panel);
    // Section headers render as distinct groups.
    expect(scope.getByText("Expérience professionnelle")).not.toBeNull();
    expect(scope.getByText("Compétences")).not.toBeNull();
    // Leaf labels + after-values render beneath their group.
    expect(scope.getByText("Expérience professionnelle #1 — Poste")).not.toBeNull();
    expect(scope.getByText("Nouveau")).not.toBeNull();
    expect(scope.getByText("Expert")).not.toBeNull();
  });

  it("shows the French no-op indicator for a commented section with no change (AC-8)", () => {
    const changes: ResumeFieldChange[] = [
      {
        label: "Expérience professionnelle #1 — Poste",
        sectionId: "work",
        sectionLabel: "Expérience professionnelle",
        before: "Ancien",
        after: "Nouveau",
      },
    ];
    render(
      <RoundDiffPanel
        round={1}
        changes={changes}
        commentedSectionIds={["work", "skills"]}
      />,
    );

    // The commented `skills` section produced no change → French no-op row.
    expect(screen.getByText("Compétences")).not.toBeNull();
    expect(
      screen.getByText(/Aucune modification détectée \(l'IA n'a rien changé\)/),
    ).not.toBeNull();
  });

  it("shows the empty-state message when there are no changes and no commented ids", () => {
    render(
      <RoundDiffPanel round={1} changes={[]} commentedSectionIds={[]} />,
    );
    expect(
      screen.getByText(/Aucune modification détectée pour ce tour/),
    ).not.toBeNull();
  });
});
