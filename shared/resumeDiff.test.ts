/**
 * Tier: node/shared — pure diff helper for the round diff panel. Covers AC-9
 * (scalar / nested-array / identical), AC-10 (added/removed leaves, array-index
 * + nested French labels, raw-path fallback, key-order stability) and the
 * PII contract (the diff is DISPLAY-ONLY — it never touches a prompt).
 */
import { describe, it, expect } from "vitest";
import { diffResumes, stringifyLeaf } from "./resumeDiff";
import type { Resume } from "./resume-types";

describe("stringifyLeaf", () => {
  it("normalizes undefined/null to empty string", () => {
    expect(stringifyLeaf(undefined)).toBe("");
    expect(stringifyLeaf(null)).toBe("");
  });

  it("stringifies scalars", () => {
    expect(stringifyLeaf("hello")).toBe("hello");
    expect(stringifyLeaf(42)).toBe("42");
    expect(stringifyLeaf(true)).toBe("true");
    expect(stringifyLeaf(false)).toBe("false");
  });
});

describe("diffResumes (AC-9)", () => {
  it("detects a scalar change (basics.summary)", () => {
    const prev: Resume = { basics: { summary: "Ancien profil" } };
    const next: Resume = { basics: { summary: "Nouveau profil" } };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      label: "Résumé / Profil",
      before: "Ancien profil",
      after: "Nouveau profil",
    });
  });

  it("detects a nested/array-element change (work[0].summary)", () => {
    const prev: Resume = { work: [{ name: "ACME", summary: "Dev" }] };
    const next: Resume = { work: [{ name: "ACME", summary: "Lead Dev" }] };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe("Expérience professionnelle #1 — Résumé");
    expect(changes[0].before).toBe("Dev");
    expect(changes[0].after).toBe("Lead Dev");
  });

  it("returns an empty list for identical resumes", () => {
    const resume: Resume = {
      basics: { name: "Jean", summary: "Profil" },
      work: [{ name: "ACME", summary: "Dev", highlights: ["a", "b"] }],
    };

    expect(diffResumes(resume, structuredClone(resume))).toEqual([]);
  });

  it("does not report false positives on key ordering", () => {
    const prev: Resume = {
      basics: { name: "Jean", summary: "Profil" },
    };
    // Same values, different insertion order of keys.
    const next: Resume = {
      basics: { summary: "Profil", name: "Jean" },
    };

    expect(diffResumes(prev, next)).toEqual([]);
  });
});

describe("diffResumes labeling (AC-10)", () => {
  it("treats an added leaf as a change with an empty before side", () => {
    const prev: Resume = { basics: {} };
    const next: Resume = { basics: { summary: "Ajouté" } };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      label: "Résumé / Profil",
      before: "",
      after: "Ajouté",
    });
  });

  it("treats a removed leaf as a change with an empty after side", () => {
    const prev: Resume = { basics: { summary: "À retirer" } };
    const next: Resume = { basics: {} };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      label: "Résumé / Profil",
      before: "À retirer",
      after: "",
    });
  });

  it("labels array elements with a French section label + 1-based index", () => {
    const prev: Resume = {
      work: [
        { name: "ACME", summary: "Un" },
        { name: "Globex", summary: "Deux" },
      ],
    };
    const next: Resume = {
      work: [
        { name: "ACME", summary: "Un" },
        { name: "Globex", summary: "Deux modifié" },
      ],
    };

    const changes = diffResumes(prev, next);
    const labels = changes.map((c) => c.label);

    // Second array element → 1-based index #2, nested French leaf label.
    expect(labels).toContain("Expérience professionnelle #2 — Résumé");
  });

  it("labels a nested-field change via RESUME_SECTIONS + LEAF_LABELS", () => {
    const prev: Resume = { education: [{ institution: "Ancienne" }] };
    const next: Resume = { education: [{ institution: "Nouvelle" }] };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe("Formation #1 — Établissement");
  });

  it("falls back to the raw key path for leaves with no French descriptor", () => {
    // `foo` is not in LEAF_LABELS → raw segment fallback (AC-10 fallback rule).
    const prev = { work: [{ foo: "a" }] } as unknown as Resume;
    const next = { work: [{ foo: "b" }] } as unknown as Resume;

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe("Expérience professionnelle #1 — foo");
  });

  it("labels array (string[]) element changes like work[0].highlights", () => {
    const prev: Resume = { work: [{ highlights: ["ancien"] }] };
    const next: Resume = { work: [{ highlights: ["nouveau"] }] };

    const changes = diffResumes(prev, next);

    expect(changes).toHaveLength(1);
    // highlights maps to "Points clés"; both array indices (the work entry and
    // the highlight element) are 1-based and attached to the section label, the
    // nested French leaf label follows after " — ".
    expect(changes[0].label).toBe(
      "Expérience professionnelle #1 #1 — Points clés",
    );
    expect(changes[0].before).toBe("ancien");
    expect(changes[0].after).toBe("nouveau");
  });
});

describe("diffResumes PII contract (AC-11 support)", () => {
  it("returns display-only values without mutating inputs (pure)", () => {
    const prev: Resume = { basics: { summary: "Secret A" } };
    const next: Resume = { basics: { summary: "Secret B" } };
    const prevSnapshot = structuredClone(prev);
    const nextSnapshot = structuredClone(next);

    const changes = diffResumes(prev, next);

    // The helper is pure — it does not mutate its inputs. The (PII-bearing)
    // values live only in the returned change objects for in-modal display;
    // callers must never forward them into a prompt.
    expect(prev).toEqual(prevSnapshot);
    expect(next).toEqual(nextSnapshot);
    expect(changes[0].before).toBe("Secret A");
    expect(changes[0].after).toBe("Secret B");
  });
});
