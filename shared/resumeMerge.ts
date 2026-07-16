import { Resume } from "./resume-types";
import { SectionComment } from "./feedbackMessages";
import { getResumeSection } from "./resume-sections";

/**
 * Deterministic section-scoped merge for the CV feedback loop.
 *
 * Given the resume BEFORE a regeneration round (`preRegen`), the LLM's full
 * updated resume (`llmOutput`), and the per-section comments actually submitted
 * this round (`commented`), return the resume to apply: ONLY the commented
 * sections come from the LLM output; everything else — all of `basics` (PII),
 * `meta`, and any unknown/non-section top-level key — is restored verbatim from
 * the pre-regen resume.
 *
 * This makes the loop robust to LLM drift: a comment scoped to one section can
 * never silently corrupt other sections or the candidate's personal info.
 *
 * Section → Resume-key mapping follows `RESUME_SECTIONS`:
 * - `summary` maps to `basics.summary` ONLY (every other `basics.*` field stays
 *   from the pre-regen resume, even if the LLM altered it).
 * - every other section id maps to its same-named top-level `Resume` key, taken
 *   verbatim from the LLM output (including when the LLM value is unchanged, or
 *   `undefined` — the LLM's new version is always trusted; no accidental
 *   restore).
 *
 * Pure: no React, no IPC, no side effects. Inputs are never mutated. Runs in the
 * renderer AFTER the LLM responds; its output is applied/displayed IN-MODAL /
 * LOCALLY only and must NEVER be serialized into a prompt (same PII rule as
 * `resumeDiff.ts` and `feedbackMessages.ts`).
 */
export function mergeScopedResume(
  preRegen: Resume,
  llmOutput: Resume,
  commented: SectionComment[],
): Resume {
  // Mirror `buildRegenerationMessage`'s blank-comment filtering so the merge
  // scope matches exactly what was actually sent to the LLM.
  const commentedIds = new Set(
    commented
      .filter((c) => c.comment.trim().length > 0)
      .map((c) => c.sectionId),
  );

  // Deep-clone the pre-regen resume as the base result. Cloning guarantees the
  // result never shares references with the LLM output for non-commented keys.
  const result = structuredClone(preRegen);

  for (const id of commentedIds) {
    // Ignore any commented id not present in RESUME_SECTIONS (defensive).
    if (!getResumeSection(id)) continue;

    if (id === "summary") {
      // Take ONLY basics.summary from the LLM; leave every other basics.* field
      // from the pre-regen clone untouched.
      const basics = result.basics ?? {};
      basics.summary = llmOutput.basics?.summary;
      result.basics = basics;
      continue;
    }

    // Every other section id → replace the same-named top-level key with a deep
    // clone of the LLM value (including when the value is undefined — trust the
    // LLM's new version verbatim).
    const value = (llmOutput as Record<string, unknown>)[id];
    (result as Record<string, unknown>)[id] = structuredClone(value);
  }

  return result;
}
