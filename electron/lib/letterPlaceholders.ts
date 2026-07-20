/**
 * Deterministic PII-placeholder restore/line-drop helper for the
 * `write_motivation_letter` specialist tool's output.
 *
 * Genuinely new, standalone, pure string-processing logic — deliberately
 * does NOT import or call `restoreBasicsPii()` (`electron/main.ts`) and
 * shares no implementation with it (per spec's explicit non-goal). This
 * runs strictly AFTER the specialist's own LLM call returns, so the real
 * PII values are never sent back into another LLM prompt (AGENTS.md rule 7).
 */

/** Fixed, literal placeholder tokens the specialist's system prompt instructs it to use verbatim. */
export const LETTER_PLACEHOLDER_TOKENS = {
  name: "[Votre nom]",
  email: "[Votre email]",
  phone: "[Votre téléphone]",
  location: "[Votre adresse]",
} as const;

/** Any collection of consecutive `[Votre …]`-shaped tokens, used to detect leftovers. */
const ANY_PLACEHOLDER_TOKEN_RE = /\[Votre [^\]]*\]/;

interface LocationLike {
  address?: unknown;
  postalCode?: unknown;
  city?: unknown;
  countryCode?: unknown;
  region?: unknown;
}

/**
 * Formats a resume `basics.location`-shaped value into a single-line,
 * free-form address string. Returns `undefined` if the value isn't a usable
 * object, or if every part is empty (treated as "absent" by the caller).
 */
function formatLocation(location: unknown): string | undefined {
  if (!location || typeof location !== "object") return undefined;
  const loc = location as LocationLike;
  const parts = [loc.address, loc.postalCode, loc.city, loc.region, loc.countryCode]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

/**
 * Substitutes the 4 fixed letter-header placeholder tokens with real values
 * from `sourceBasics` (when present/non-empty), and drops any line still
 * containing an un-substitutable token.
 *
 * Behavior (binding per spec "Data & PII notes"):
 * 1. For each token, treat the corresponding `sourceBasics` field as
 *    "present" only if it is a non-empty string after `.trim()` (for
 *    `location`, formatted via `formatLocation` first).
 * 2. Replace every literal occurrence of a "present" token with the real
 *    value (plain string split/join — tokens are fixed literals, not user
 *    input, so there is no regex-injection risk).
 * 3. Split the (partially-substituted) text on `\n`; drop any line that
 *    still contains ANY of the four literal tokens; rejoin with `\n`;
 *    collapse 2+ consecutive blank lines into a single blank line.
 */
export function substituteLetterPlaceholders(
  letterText: string,
  sourceBasics:
    | { name?: string; email?: string; phone?: string; location?: unknown }
    | undefined,
): string {
  const values: Record<keyof typeof LETTER_PLACEHOLDER_TOKENS, string | undefined> = {
    name:
      typeof sourceBasics?.name === "string" && sourceBasics.name.trim()
        ? sourceBasics.name.trim()
        : undefined,
    email:
      typeof sourceBasics?.email === "string" && sourceBasics.email.trim()
        ? sourceBasics.email.trim()
        : undefined,
    phone:
      typeof sourceBasics?.phone === "string" && sourceBasics.phone.trim()
        ? sourceBasics.phone.trim()
        : undefined,
    location: formatLocation(sourceBasics?.location),
  };

  let substituted = letterText;
  for (const key of Object.keys(LETTER_PLACEHOLDER_TOKENS) as Array<
    keyof typeof LETTER_PLACEHOLDER_TOKENS
  >) {
    const value = values[key];
    if (value === undefined) continue;
    const token = LETTER_PLACEHOLDER_TOKENS[key];
    substituted = substituted.split(token).join(value);
  }

  const linesWithoutLeftovers = substituted
    .split("\n")
    .filter((line) => !ANY_PLACEHOLDER_TOKEN_RE.test(line));

  // Collapse 2+ consecutive blank lines into a single blank line.
  const collapsed: string[] = [];
  for (const line of linesWithoutLeftovers) {
    const isBlank = line.trim().length === 0;
    const prevBlank = collapsed.length > 0 && collapsed[collapsed.length - 1].trim().length === 0;
    if (isBlank && prevBlank) continue;
    collapsed.push(line);
  }

  return collapsed.join("\n");
}
