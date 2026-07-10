/**
 * Tier 1 + 2 — theme rendering + Handlebars helpers in themes/shared/render.ts
 *
 * `renderTheme` is exported. The helpers are registered as a side-effect of
 * importing this module, so `import "./render"` then use Handlebars.compile to
 * exercise them (or test observable output through renderTheme).
 *
 * See tests/TEST_PLAN.md → "Tier 1/2: themes".
 */
import { describe, it } from "vitest";
// import { renderTheme } from "./render";

describe("renderTheme", () => {
  it.todo("renders each of the 9 registered themes to a non-empty HTML string");
  it.todo("throws 'Unknown theme' for an unregistered name");
  it.todo("includes provided resume field values in the output");
  it.todo("does not HTML-escape the base64 image via the safeImage helper");
});

describe("Handlebars helpers", () => {
  it.todo("paragraphSplit wraps each non-empty line in <p>…</p>");
  it.todo("paragraphSplit skips blank lines");
  it.todo("toLowerCase lowercases a string");
  it.todo("spaceToDash replaces spaces with dashes and lowercases");
  it.todo("MY formats a date as 'MMMM YYYY' in French locale");
  it.todo("Y formats a date as 'YYYY'");
  it.todo("DMY formats a date as 'D MMMM YYYY' in French locale");
});

describe("themes registry (themes/index.ts)", () => {
  it.todo("exposes exactly 9 themes");
  it.todo("includes 'modern-sidebar' (the fallback default)");
});
