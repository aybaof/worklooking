import { ErrorCodes } from "../../shared/ipc";
import { IPCError } from "./paths";

// Unicode "Combining Diacritical Marks" block (U+0300-U+036F): produced by
// String#normalize("NFD") when splitting accented letters (e.g. "e" + a
// combining grave accent) so they can be stripped, leaving the base ASCII
// letter behind.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Slugify one side (company or position) of the candidature folder segment:
 * strip accents, lowercase, collapse any run of characters outside
 * `[a-z0-9]` (including `/`, `\`, `.`, spaces, null bytes, etc.) to a single
 * hyphen, and trim leading/trailing hyphens.
 *
 * Only `[a-z0-9-]` characters can ever survive this transform, so traversal
 * sequences (`../`), absolute-path prefixes, separators, and unsafe
 * characters are neutralized before any path is assembled.
 */
function slugifySegment(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive the `company_position` candidature folder segment from raw
 * `company`/`position` strings supplied by the model, matching the
 * `candidatures/entreprise_poste/` convention documented in
 * `electron/agent/agent.md` (lowercase, hyphenated multi-word segments,
 * underscore between company and position, no dates).
 *
 * Pure and side-effect-free. Throws `IPCError(ErrorCodes.INVALID_PATH, …)` if
 * either side sanitizes to an empty string (blank input or input consisting
 * entirely of unsafe characters), so callers never assemble a path from an
 * empty/degenerate segment.
 */
export function deriveCandidatureFolderSegment(
  company: string,
  position: string,
): string {
  const companySlug = slugifySegment(company);
  const positionSlug = slugifySegment(position);

  if (!companySlug || !positionSlug) {
    throw new IPCError(
      ErrorCodes.INVALID_PATH,
      "company/position must not be empty after sanitization",
    );
  }

  return `${companySlug}_${positionSlug}`;
}
