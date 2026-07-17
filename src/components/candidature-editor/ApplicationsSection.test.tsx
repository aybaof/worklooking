/**
 * Tier 3 — renderer component. Covers AC-15/AC-16/AC-17:
 * `resume_path` renders as read-only text (not an editable `Field`/`Input`)
 * plus a working "reveal in folder" button when present; rows with an empty
 * or entirely-absent `resume_path` show neither. Also guards AC-10's
 * field-independence: `notes_path` remains an editable `Field`, unaffected.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CandidatureConfig } from "@/../shared/candidature-types";
import { Channels } from "@/../shared/ipc";
import { installMockWindowApi } from "../../../tests/renderer/mockWindowApi";
import { ApplicationsSection } from "./ApplicationsSection";

type Application = CandidatureConfig["applications"][number];

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    company: "Doctolib",
    position: "Développeur Fullstack",
    date: "2026-07-17",
    status: "Envoyée",
    follow_up: "",
    notes_path: "/tmp/notes.txt",
    resume_path: "/tmp/candidatures/doctolib/resume.pdf",
    ...overrides,
  };
}

function renderSection(items: Application[]) {
  const api = installMockWindowApi();
  const onUpdate = vi.fn();
  render(
    <ApplicationsSection
      items={items}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onUpdate={onUpdate}
    />,
  );
  return { api, onUpdate };
}

describe("ApplicationsSection (AC-15, AC-16, AC-17)", () => {
  it("shows resume_path as read-only text (not an <input>) plus a working reveal button (AC-15)", () => {
    const { api } = renderSection([makeApplication()]);

    const pathText = screen.getByText(
      "/tmp/candidatures/doctolib/resume.pdf",
    );
    expect(pathText).not.toBeNull();
    // Not inside an <input> — a plain text node, unlike notes_path's Field.
    expect(pathText.closest("input")).toBeNull();

    const revealButton = screen.getByText("Afficher dans le dossier");
    fireEvent.click(revealButton);

    expect(api.invoke).toHaveBeenCalledWith(
      Channels.SHELL_SHOW_ITEM_IN_FOLDER,
      { path: "/tmp/candidatures/doctolib/resume.pdf" },
    );
  });

  it("shows no path text and no reveal button when resume_path is an empty string (AC-16)", () => {
    renderSection([makeApplication({ resume_path: "" })]);

    expect(screen.queryByText(/resume\.pdf/)).toBeNull();
    expect(screen.queryByText("Afficher dans le dossier")).toBeNull();
    // Empty-state placeholder line is present instead.
    expect(
      screen.getByText(/Aucun CV généré pour cette candidature/),
    ).not.toBeNull();
  });

  it("shows no path text and no reveal button when resume_path is omitted entirely (AC-16, AC-17)", () => {
    // Simulate a pre-migration persisted record with no `resume_path` key at
    // all in the parsed JSON.
    const preMigrationRow = {
      company: "Globex",
      position: "Ingénieur",
      date: "2025-01-01",
      status: "Envoyée",
      follow_up: "",
      notes_path: "",
    } as unknown as Application;

    expect(() => renderSection([preMigrationRow])).not.toThrow();

    expect(screen.queryByText(/resume\.pdf/)).toBeNull();
    expect(screen.queryByText("Afficher dans le dossier")).toBeNull();
    expect(
      screen.getByText(/Aucun CV généré pour cette candidature/),
    ).not.toBeNull();
  });

  it("leaves notes_path's editable Field unaffected — still an <input>, calls onUpdate on change (AC-10 regression)", () => {
    const { onUpdate } = renderSection([makeApplication()]);

    const notesInput = screen.getByDisplayValue(
      "/tmp/notes.txt",
    ) as HTMLInputElement;
    expect(notesInput.tagName).toBe("INPUT");

    fireEvent.change(notesInput, { target: { value: "/tmp/new-notes.txt" } });

    expect(onUpdate).toHaveBeenCalledWith(0, "notes_path", "/tmp/new-notes.txt");
    // resume_path is untouched by a notes_path edit.
    expect(onUpdate).not.toHaveBeenCalledWith(
      0,
      "resume_path",
      expect.anything(),
    );
  });

  it("labels the resume_path block distinctly from 'Chemin des notes'", () => {
    renderSection([makeApplication()]);

    expect(screen.getByText("Chemin des notes")).not.toBeNull();
    expect(screen.getByText("Chemin du CV généré")).not.toBeNull();
  });
});
