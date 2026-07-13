import { Resume } from "./resume-types";

/**
 * Descriptor for a single JSON Resume section usable by the feedback loop.
 *
 * `id` matches the JSON Resume key (except `summary`, which maps to
 * `basics.summary`). `label` is French UI copy. `hasContent` is a pure
 * presence predicate used to decide whether a pin should be shown for the
 * section — it never returns true for absent/empty sections, which prevents
 * broken pins for missing data.
 *
 * IMPORTANT: this module carries NO PII. It only enumerates section
 * ids/labels; resume field values are never embedded here and must never be
 * placed into the regeneration prompt.
 */
export interface ResumeSectionDescriptor {
  id: string;
  label: string;
  hasContent: (resume: Resume) => boolean;
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Every JSON Resume section, in a stable display order. The pin rail renders
 * one entry per section whose `hasContent(resume)` is true.
 */
export const RESUME_SECTIONS: ResumeSectionDescriptor[] = [
  {
    id: "summary",
    label: "Résumé / Profil",
    hasContent: (resume) => nonEmptyString(resume.basics?.summary),
  },
  {
    id: "work",
    label: "Expérience professionnelle",
    hasContent: (resume) => nonEmptyArray(resume.work),
  },
  {
    id: "education",
    label: "Formation",
    hasContent: (resume) => nonEmptyArray(resume.education),
  },
  {
    id: "skills",
    label: "Compétences",
    hasContent: (resume) => nonEmptyArray(resume.skills),
  },
  {
    id: "projects",
    label: "Projets",
    hasContent: (resume) => nonEmptyArray(resume.projects),
  },
  {
    id: "awards",
    label: "Distinctions",
    hasContent: (resume) => nonEmptyArray(resume.awards),
  },
  {
    id: "languages",
    label: "Langues",
    hasContent: (resume) => nonEmptyArray(resume.languages),
  },
  {
    id: "volunteer",
    label: "Bénévolat",
    hasContent: (resume) => nonEmptyArray(resume.volunteer),
  },
  {
    id: "publications",
    label: "Publications",
    hasContent: (resume) => nonEmptyArray(resume.publications),
  },
  {
    id: "references",
    label: "Références",
    hasContent: (resume) => nonEmptyArray(resume.references),
  },
  {
    id: "interests",
    label: "Centres d'intérêt",
    hasContent: (resume) => nonEmptyArray(resume.interests),
  },
];

/** Look up a section descriptor by its id. */
export function getResumeSection(
  id: string,
): ResumeSectionDescriptor | undefined {
  return RESUME_SECTIONS.find((section) => section.id === id);
}

/** French label for a section id, falling back to the id itself. */
export function getResumeSectionLabel(id: string): string {
  return getResumeSection(id)?.label ?? id;
}
