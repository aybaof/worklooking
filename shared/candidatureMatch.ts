import { CandidatureConfig } from "./candidature-types";

type Application = CandidatureConfig["applications"][number];

/**
 * Find the index of the `applications` entry matching `company` AND
 * `position` (both trimmed, case-insensitively) — used by `App.tsx`'s
 * match-or-create wiring on a full-success `validate()` (AC-12). Returns `-1`
 * when no entry matches on BOTH fields (including on an empty array).
 *
 * Pure/framework-free: no side effects, no dependency on `useCandidatureConfig`
 * — the caller performs the actual mutation via the existing
 * `updateItem`/`addItem`.
 */
export function findMatchingApplicationIndex(
  applications: Application[],
  company: string,
  position: string,
): number {
  const normalizedCompany = company.trim().toLowerCase();
  const normalizedPosition = position.trim().toLowerCase();

  return applications.findIndex(
    (app) =>
      app.company.trim().toLowerCase() === normalizedCompany &&
      app.position.trim().toLowerCase() === normalizedPosition,
  );
}

/**
 * Build the default `applications` entry appended when no match is found
 * (AC-13). `company`/`position` are kept AS-IS (original casing, not the
 * lower-cased comparison value used by `findMatchingApplicationIndex`).
 * `today` is an optional injectable `Date` (defaults to `new Date()`) purely
 * so tests can pin the formatted date deterministically.
 */
export function buildDefaultApplication(
  company: string,
  position: string,
  resumePath: string,
  today: Date = new Date(),
): Application {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    company,
    position,
    date: `${year}-${month}-${day}`,
    status: "Envoyée",
    follow_up: "",
    notes_path: "",
    resume_path: resumePath,
  };
}
