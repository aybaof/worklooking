import { Resume } from "./resume-types";
import { getResumeSectionLabel } from "./resume-sections";

/**
 * A single leaf-field difference between two successive tailored resumes,
 * ready for in-modal display in the round diff panel.
 *
 * IMPORTANT — PII: `before`/`after` hold resume field VALUES (names, dates,
 * descriptions, etc.). This is allowed for local in-modal display ONLY. These
 * values must NEVER be serialized into any prompt / `AI_CHAT` payload (see
 * `shared/feedbackMessages.ts`, which stays label + comment only).
 */
export interface ResumeFieldChange {
  /** Human-readable French label built from the field path. */
  label: string;
  /**
   * Structured grouping key for the change's section. Matches a
   * `RESUME_SECTIONS` id (`summary` for `basics.summary`), the `"__basics"`
   * sentinel for other `basics.*` fields, otherwise the top-level Resume key.
   * Lets `RoundDiffPanel` group without re-parsing `label`.
   */
  sectionId: string;
  /** French section label for `sectionId` (header text in the round diff). */
  sectionLabel: string;
  /** Previous stringified value (`""` when added). */
  before: string;
  /** New stringified value (`""` when removed). */
  after: string;
}

/**
 * French labels for common nested leaf keys. Any key not covered falls back to
 * its raw path segment (AC-10 fallback rule). No PII — keys only.
 */
const LEAF_LABELS: Record<string, string> = {
  summary: "Résumé",
  name: "Nom",
  label: "Titre",
  position: "Poste",
  highlights: "Points clés",
  url: "URL",
  email: "E-mail",
  phone: "Téléphone",
  startDate: "Date de début",
  endDate: "Date de fin",
  institution: "Établissement",
  area: "Domaine",
  studyType: "Diplôme",
  score: "Note",
  courses: "Cours",
  organization: "Organisation",
  title: "Titre",
  date: "Date",
  awarder: "Décerné par",
  publisher: "Éditeur",
  releaseDate: "Date de parution",
  level: "Niveau",
  keywords: "Mots-clés",
  language: "Langue",
  fluency: "Aisance",
  reference: "Référence",
  description: "Description",
  roles: "Rôles",
  entity: "Entité",
  type: "Type",
  network: "Réseau",
  username: "Identifiant",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
  countryCode: "Pays",
  region: "Région",
  image: "Image",
};

/**
 * Normalize a leaf value to a comparable/displayable string. `undefined`/`null`
 * become `""` so added/removed leaves compare cleanly; everything else uses
 * `String(v)`. This avoids `JSON.stringify` key-order false positives.
 */
export function stringifyLeaf(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function isLeaf(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Map the first path segment to a French section label via `RESUME_SECTIONS`.
 * `basics.summary` is a special case: its user-facing section is the
 * `"summary"` descriptor. Otherwise the top-level Resume key is used directly
 * (falling back to the raw key when no descriptor exists).
 */
function topLevelLabel(path: PathSegment[]): string {
  const first = path[0];
  if (first === undefined || typeof first !== "string") return "";
  if (first === "basics") {
    const second = path[1];
    if (second === "summary") return getResumeSectionLabel("summary");
    // Other basics.* fields have no section descriptor; label as "Informations".
    return "Informations";
  }
  return getResumeSectionLabel(first);
}

/**
 * Structured grouping key for a leaf path (see `ResumeFieldChange.sectionId`).
 * `basics.summary` → `"summary"`; other `basics.*` → `"__basics"` sentinel;
 * otherwise the top-level Resume key. Empty string for a malformed path.
 */
function topLevelSectionId(path: PathSegment[]): string {
  const first = path[0];
  if (first === undefined || typeof first !== "string") return "";
  if (first === "basics") {
    return path[1] === "summary" ? "summary" : "__basics";
  }
  return first;
}

type PathSegment = string | number;

/**
 * Build a human-readable French label for a leaf path. Array indices are
 * rendered 1-based and attached to the preceding section label
 * (e.g. `Expérience professionnelle #1`); remaining nested keys are mapped
 * through `LEAF_LABELS` (raw fallback) and joined with ` — `.
 */
function buildLabel(path: PathSegment[]): string {
  const section = topLevelLabel(path);
  const parts: string[] = [];

  // Skip the segments already consumed by the section label.
  let startIndex = 1;
  if (path[0] === "basics" && path[1] === "summary") {
    // Whole path consumed → just the section label.
    return section;
  }
  if (path[0] === "basics") {
    startIndex = 1;
  }

  let sectionWithIndex = section;
  for (let i = startIndex; i < path.length; i++) {
    const seg = path[i];
    if (typeof seg === "number") {
      sectionWithIndex = `${sectionWithIndex} #${seg + 1}`;
    } else {
      parts.push(LEAF_LABELS[seg] ?? seg);
    }
  }

  return [sectionWithIndex, ...parts].join(" — ");
}

function walk(
  prev: unknown,
  next: unknown,
  path: PathSegment[],
  changes: ResumeFieldChange[],
): void {
  if (isLeaf(prev) && isLeaf(next)) {
    const before = stringifyLeaf(prev);
    const after = stringifyLeaf(next);
    if (before !== after) {
      changes.push({
        label: buildLabel(path),
        sectionId: topLevelSectionId(path),
        sectionLabel: topLevelLabel(path),
        before,
        after,
      });
    }
    return;
  }

  if (Array.isArray(prev) || Array.isArray(next)) {
    const prevArr = Array.isArray(prev) ? prev : [];
    const nextArr = Array.isArray(next) ? next : [];
    const len = Math.max(prevArr.length, nextArr.length);
    for (let i = 0; i < len; i++) {
      walk(prevArr[i], nextArr[i], [...path, i], changes);
    }
    return;
  }

  if (isPlainObject(prev) || isPlainObject(next)) {
    const prevObj = isPlainObject(prev) ? prev : {};
    const nextObj = isPlainObject(next) ? next : {};
    const keys = new Set<string>([
      ...Object.keys(prevObj),
      ...Object.keys(nextObj),
    ]);
    for (const key of keys) {
      walk(prevObj[key], nextObj[key], [...path, key], changes);
    }
    return;
  }

  // Type mismatch between leaf and container: record a coarse change.
  const before = stringifyLeaf(prev);
  const after = stringifyLeaf(next);
  if (before !== after) {
    changes.push({
      label: buildLabel(path),
      sectionId: topLevelSectionId(path),
      sectionLabel: topLevelLabel(path),
      before,
      after,
    });
  }
}

/**
 * Diff two successive tailored resumes and return the list of leaf-field
 * changes. Walks both objects recursively over the UNION of keys, treating
 * string/number/boolean (and `null`/absent) as leaves, comparing normalized
 * string form. Arrays are walked by index. Identical resumes → `[]`.
 *
 * Pure: no React, no IPC. Its output is for in-modal display only and must
 * never flow into a prompt.
 */
export function diffResumes(previous: Resume, next: Resume): ResumeFieldChange[] {
  const changes: ResumeFieldChange[] = [];
  const keys = new Set<string>([
    ...Object.keys(previous),
    ...Object.keys(next),
  ]);
  for (const key of keys) {
    walk(
      (previous as Record<string, unknown>)[key],
      (next as Record<string, unknown>)[key],
      [key],
      changes,
    );
  }
  return changes;
}
