/**
 * Regression guard for the "one A4 page only" print-CSS clamp
 * (`@media print { html, body { height: 297mm; overflow: hidden } }`), which
 * previously truncated multi-page PDF exports to page 1 (see
 * `.work/features/resume-multipage-render-fix/`).
 *
 * Static CSS inspection only — jsdom/CI has no real layout/pagination engine
 * to pixel-diff, so this asserts the offending declarations are absent from
 * each theme's compiled `style.css` rather than attempting a real render.
 * The real behavioral proof (actual multi-page PDF output) lives in the
 * manual `scripts/verify-multipage-pdf.ts` script (`npm run verify:pdf`).
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const THEMES_DIR = path.resolve(__dirname);

/** Themes with a `@media print { html, body { ... } }` block that historically
 * clamped `height: 297mm` + `overflow: hidden`. */
const THEMES_WITH_PRINT_CLAMP = [
  "professional",
  "bold",
  "compact",
  "creative",
  "elegant",
  "minimal",
  "simple",
  "modern-sidebar",
] as const;

/** All 9 registered themes, per `electron/themes/index.ts`. */
const ALL_THEMES = [...THEMES_WITH_PRINT_CLAMP, "spartan-fr"] as const;

function readThemeCss(themeName: string): string {
  return fs.readFileSync(
    path.join(THEMES_DIR, themeName, "style.css"),
    "utf-8",
  );
}

function extractMediaPrintBlock(css: string): string | null {
  const match = css.match(/@media print\s*\{/);
  if (!match) return null;
  const start = match.index! + match[0].length;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(start, i - 1);
}

describe("theme print CSS: no stale one-page clamp", () => {
  it("enumerates exactly the 9 registered themes", () => {
    expect(ALL_THEMES).toHaveLength(9);
  });

  for (const themeName of THEMES_WITH_PRINT_CLAMP) {
    it(`${themeName}: @media print no longer clamps html/body to a fixed height + overflow: hidden`, () => {
      const css = readThemeCss(themeName);
      const printBlock = extractMediaPrintBlock(css);
      expect(printBlock).not.toBeNull();

      // The historical bug: an `html, body { ... }` rule setting a fixed
      // `height:` (e.g. `297mm`) together with `overflow: hidden`. Neither
      // should appear anywhere in the print block anymore.
      expect(printBlock).not.toMatch(/height:\s*297mm/);
      expect(printBlock).not.toMatch(/overflow:\s*hidden/);

      // `width: 210mm` is fine to keep (doesn't clip vertically).
      expect(printBlock).toMatch(/width:\s*210mm/);
    });
  }

  it("modern-sidebar: no fixed `height` (as opposed to `min-height`) declaration on .resume", () => {
    const css = readThemeCss("modern-sidebar");

    // Isolate the `.resume { ... }` rule(s) and check for a bare `height:`
    // declaration (not `min-height:`) — a negative lookbehind-free approach:
    // strip all `min-height:` occurrences first, then look for `height:`.
    const resumeRuleMatches = [...css.matchAll(/\.resume\s*\{([^}]*)\}/g)];
    expect(resumeRuleMatches.length).toBeGreaterThan(0);

    for (const [, body] of resumeRuleMatches) {
      const withoutMinHeight = body.replace(/min-height\s*:/g, "");
      expect(withoutMinHeight).not.toMatch(/height\s*:/);
    }
  });

  it("modern-sidebar: print block no longer overrides .resume/.sidebar/.main-content height", () => {
    const css = readThemeCss("modern-sidebar");
    const printBlock = extractMediaPrintBlock(css);
    expect(printBlock).not.toBeNull();

    for (const selector of [".resume", ".sidebar", ".main-content"]) {
      const ruleMatch = printBlock!.match(
        new RegExp(
          `${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`,
        ),
      );
      if (ruleMatch) {
        expect(ruleMatch[1]).not.toMatch(/height\s*:/);
      }
    }
  });

  it("spartan-fr: still has no @media print block (regression guard — audited, no fix needed)", () => {
    // `spartan-fr` was audited (see plan.md) and confirmed to have no
    // `@media print` block and no page-level height/overflow clamp on
    // `html`/`body`/`#resume` — it does not exhibit the bug this test file
    // guards against, so no CSS change was made for it. This is a regression
    // guard so a future edit doesn't silently (re)introduce a print block
    // with the clamp. (Its `.stack-overflow::after` decorative icon rule
    // legitimately uses `overflow: hidden` scoped to its own small element —
    // unrelated to the page-level clamp, so not asserted against here.)
    const css = readThemeCss("spartan-fr");
    expect(extractMediaPrintBlock(css)).toBeNull();
  });
});
