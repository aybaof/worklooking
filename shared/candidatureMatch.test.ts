/**
 * Tier: node/pure. Covers `findMatchingApplicationIndex` (AC-12) and
 * `buildDefaultApplication` (AC-13) — the pure match-or-create helpers used
 * by `App.tsx`'s `onFullValidationSuccess` wiring. Runs in the `node` Vitest
 * project (`shared/**`).
 */
import { describe, it, expect } from "vitest";
import {
  findMatchingApplicationIndex,
  buildDefaultApplication,
} from "./candidatureMatch";
import type { CandidatureConfig } from "./candidature-types";

type Application = CandidatureConfig["applications"][number];

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    company: "Acme",
    position: "Développeur",
    date: "2026-01-01",
    status: "Envoyée",
    follow_up: "",
    notes_path: "",
    resume_path: "",
    ...overrides,
  };
}

describe("findMatchingApplicationIndex (AC-12)", () => {
  it("matches on trimmed, case-insensitive company AND position", () => {
    const applications = [
      makeApplication({ company: "Doctolib", position: "Développeur Fullstack" }),
    ];

    expect(
      findMatchingApplicationIndex(
        applications,
        "  DOCTOLIB  ",
        "  développeur fullstack  ",
      ),
    ).toBe(0);
  });

  it("returns -1 when only company matches (position differs)", () => {
    const applications = [
      makeApplication({ company: "Doctolib", position: "Développeur Fullstack" }),
    ];

    expect(
      findMatchingApplicationIndex(applications, "Doctolib", "Lead Dev"),
    ).toBe(-1);
  });

  it("returns -1 when only position matches (company differs)", () => {
    const applications = [
      makeApplication({ company: "Doctolib", position: "Développeur Fullstack" }),
    ];

    expect(
      findMatchingApplicationIndex(
        applications,
        "AutreEntreprise",
        "Développeur Fullstack",
      ),
    ).toBe(-1);
  });

  it("returns -1 on an empty applications array", () => {
    expect(findMatchingApplicationIndex([], "Doctolib", "Lead Dev")).toBe(-1);
  });

  it("returns the correct index among several entries", () => {
    const applications = [
      makeApplication({ company: "Acme", position: "Ingénieur" }),
      makeApplication({ company: "Globex", position: "Chef de projet" }),
      makeApplication({ company: "Doctolib", position: "Développeur Fullstack" }),
    ];

    expect(
      findMatchingApplicationIndex(
        applications,
        "doctolib",
        "développeur fullstack",
      ),
    ).toBe(2);
  });
});

describe("buildDefaultApplication (AC-13)", () => {
  it("returns the exact default shape with the injected today date", () => {
    const today = new Date(2026, 6, 17); // month is 0-indexed -> 2026-07-17
    const result = buildDefaultApplication(
      "Doctolib",
      "Développeur Fullstack",
      "/tmp/candidatures/doctolib_dev/resume.pdf",
      today,
    );

    expect(result).toEqual({
      company: "Doctolib",
      position: "Développeur Fullstack",
      date: "2026-07-17",
      status: "Envoyée",
      follow_up: "",
      notes_path: "",
      resume_path: "/tmp/candidatures/doctolib_dev/resume.pdf",
    });
  });

  it("preserves company/position original casing, not a lower-cased value", () => {
    const today = new Date(2026, 0, 5);
    const result = buildDefaultApplication(
      "DocToLib",
      "DÉVELOPPEUR Fullstack",
      "/tmp/r.pdf",
      today,
    );

    expect(result.company).toBe("DocToLib");
    expect(result.position).toBe("DÉVELOPPEUR Fullstack");
  });

  it("formats single-digit month/day with zero-padding", () => {
    const today = new Date(2026, 2, 4); // 2026-03-04
    const result = buildDefaultApplication("Acme", "Dev", "/tmp/r.pdf", today);
    expect(result.date).toBe("2026-03-04");
  });
});
