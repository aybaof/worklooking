/**
 * Unit tests for the pure section-scoped merge (`shared/resumeMerge.ts`).
 * Maps the merge acceptance criteria: only commented sections come from the LLM
 * output; everything else — non-commented sections, all `basics` PII, `meta`,
 * and unknown top-level keys — is restored verbatim from the pre-regen resume.
 * Pure/no-mutation. Node project (`shared/**`).
 */
import { describe, it, expect } from "vitest";
import type { Resume } from "./resume-types";
import type { SectionComment } from "./feedbackMessages";
import { mergeScopedResume } from "./resumeMerge";

const preRegen: Resume = {
  basics: {
    name: "Jean Dupont",
    email: "jean@example.com",
    phone: "0600000000",
    summary: "Ancien résumé",
    location: { city: "Paris", countryCode: "FR" },
    profiles: [{ network: "GitHub", username: "jd" }],
    image: "photo.png",
  },
  work: [{ name: "ACME", position: "Dev" }],
  education: [{ institution: "Université" }],
  skills: [{ name: "TypeScript" }],
  meta: { theme: "modern-sidebar", version: "1.0" },
  customTopLevel: { keep: "me" },
};

function comments(ids: string[]): SectionComment[] {
  return ids.map((sectionId) => ({ sectionId, comment: "change" }));
}

describe("mergeScopedResume", () => {
  it("keeps a non-commented section deep-equal to pre-regen even if the LLM changed it (AC-2)", () => {
    const llmOutput: Resume = {
      ...preRegen,
      education: [{ institution: "AUTRE UNIVERSITÉ" }],
    };
    const merged = mergeScopedResume(preRegen, llmOutput, comments(["work"]));
    expect(merged.education).toEqual(preRegen.education);
  });

  it("restores the full basics block, meta, and unknown keys from pre-regen (AC-3)", () => {
    const llmOutput: Resume = {
      basics: {
        name: "USURPÉ",
        email: "hack@evil.com",
        phone: "0000",
        summary: "changé",
        location: { city: "Berlin" },
        profiles: [{ network: "X" }],
        image: "evil.png",
      },
      work: [{ name: "NEW", position: "Lead" }],
      meta: { theme: "hacked" },
      customTopLevel: { keep: "changed" },
    };
    const merged = mergeScopedResume(preRegen, llmOutput, comments(["work"]));
    expect(merged.basics).toEqual(preRegen.basics);
    expect(merged.meta).toEqual(preRegen.meta);
    expect(merged.customTopLevel).toEqual(preRegen.customTopLevel);
  });

  it("takes a commented section from the LLM verbatim, including unchanged and undefined (AC-4)", () => {
    // Changed value.
    const changed: Resume = { ...preRegen, work: [{ name: "NEW", position: "Lead" }] };
    expect(
      mergeScopedResume(preRegen, changed, comments(["work"])).work,
    ).toEqual(changed.work);

    // Unchanged value — still trust the LLM version (no accidental restore).
    const same: Resume = { ...preRegen };
    expect(mergeScopedResume(preRegen, same, comments(["work"])).work).toEqual(
      preRegen.work,
    );

    // Undefined value — trust the LLM (section removed).
    const removed: Resume = { ...preRegen, work: undefined };
    expect(
      mergeScopedResume(preRegen, removed, comments(["work"])).work,
    ).toBeUndefined();
  });

  it("takes ONLY basics.summary from the LLM when summary is commented (AC-5)", () => {
    const llmOutput: Resume = {
      basics: {
        name: "USURPÉ",
        email: "hack@evil.com",
        phone: "0000",
        summary: "Nouveau résumé",
        location: { city: "Berlin" },
        profiles: [{ network: "X" }],
        image: "evil.png",
      },
    };
    const merged = mergeScopedResume(preRegen, llmOutput, comments(["summary"]));
    expect(merged.basics?.summary).toBe("Nouveau résumé");
    // Every other basics.* stays from the pre-regen resume.
    expect(merged.basics?.name).toBe(preRegen.basics?.name);
    expect(merged.basics?.email).toBe(preRegen.basics?.email);
    expect(merged.basics?.phone).toBe(preRegen.basics?.phone);
    expect(merged.basics?.location).toEqual(preRegen.basics?.location);
    expect(merged.basics?.profiles).toEqual(preRegen.basics?.profiles);
    expect(merged.basics?.image).toBe(preRegen.basics?.image);
  });

  it("treats blank-comment sections as not-commented (scope matches sent message)", () => {
    const llmOutput: Resume = { ...preRegen, work: [{ name: "NEW" }] };
    const blank: SectionComment[] = [{ sectionId: "work", comment: "   " }];
    const merged = mergeScopedResume(preRegen, llmOutput, blank);
    // Not counted as commented → restored from pre-regen.
    expect(merged.work).toEqual(preRegen.work);
  });

  it("ignores a commented id absent from RESUME_SECTIONS without crashing", () => {
    const llmOutput: Resume = { ...preRegen, work: [{ name: "NEW" }] };
    expect(() =>
      mergeScopedResume(preRegen, llmOutput, comments(["nope"])),
    ).not.toThrow();
  });

  it("does not mutate its inputs (AC-1, side-effect free)", () => {
    const preSnapshot = structuredClone(preRegen);
    const llmOutput: Resume = { ...preRegen, work: [{ name: "NEW" }] };
    const llmSnapshot = structuredClone(llmOutput);

    mergeScopedResume(preRegen, llmOutput, comments(["work", "summary"]));

    expect(preRegen).toEqual(preSnapshot);
    expect(llmOutput).toEqual(llmSnapshot);
  });
});
