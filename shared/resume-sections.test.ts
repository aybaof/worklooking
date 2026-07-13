/**
 * Tier: node/shared — pure descriptor. Asserts every JSON Resume section is
 * present and `hasContent` correctly detects presence/absence.
 * Covers AC-3 and the "no broken pins for empty sections" edge case.
 */
import { describe, it, expect } from "vitest";
import { RESUME_SECTIONS, getResumeSectionLabel } from "./resume-sections";
import type { Resume } from "./resume-types";

const EXPECTED_IDS = [
  "summary",
  "work",
  "education",
  "skills",
  "projects",
  "awards",
  "languages",
  "volunteer",
  "publications",
  "references",
  "interests",
];

describe("RESUME_SECTIONS", () => {
  it("enumerates every JSON Resume section id", () => {
    const ids = RESUME_SECTIONS.map((s) => s.id);
    for (const id of EXPECTED_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toHaveLength(EXPECTED_IDS.length);
  });

  it("has a non-empty French label for every section", () => {
    for (const section of RESUME_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("hasContent is false for an empty resume", () => {
    const empty: Resume = {};
    for (const section of RESUME_SECTIONS) {
      expect(section.hasContent(empty)).toBe(false);
    }
  });

  it("hasContent is false for empty arrays / blank summary", () => {
    const resume: Resume = {
      basics: { summary: "   " },
      work: [],
      education: [],
      skills: [],
      projects: [],
      awards: [],
      languages: [],
      volunteer: [],
      publications: [],
      references: [],
      interests: [],
    };
    for (const section of RESUME_SECTIONS) {
      expect(section.hasContent(resume)).toBe(false);
    }
  });

  it("hasContent is true when a section is populated", () => {
    const resume: Resume = {
      basics: { summary: "Développeur" },
      work: [{ name: "ACME" }],
      education: [{ institution: "X" }],
      skills: [{ name: "TS" }],
      projects: [{ name: "P" }],
      awards: [{ title: "A" }],
      languages: [{ language: "Français" }],
      volunteer: [{ organization: "V" }],
      publications: [{ name: "Pub" }],
      references: [{ name: "R" }],
      interests: [{ name: "I" }],
    };
    for (const section of RESUME_SECTIONS) {
      expect(section.hasContent(resume)).toBe(true);
    }
  });

  it("getResumeSectionLabel falls back to the id for unknown sections", () => {
    expect(getResumeSectionLabel("summary")).toBe("Résumé / Profil");
    expect(getResumeSectionLabel("unknown")).toBe("unknown");
  });
});
