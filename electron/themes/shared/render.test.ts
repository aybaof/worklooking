/**
 * Tier 1 + 2 — theme rendering + Handlebars helpers in themes/shared/render.ts
 *
 * `renderTheme` is exported. The helpers are registered as a side-effect of
 * importing this module, so `import "./render"` then use Handlebars.compile to
 * exercise them (or test observable output through renderTheme).
 *
 * See tests/TEST_PLAN.md → "Tier 1/2: themes".
 */
import Handlebars from "handlebars";
import { describe, it, expect } from "vitest";
import { renderTheme } from "./render";
import { themes } from "../index";
import type { Resume } from "../../../shared/resume-types";

const sampleResume: Resume = {
  basics: {
    name: "Jane Doe",
    label: "Senior Engineer",
    email: "jane@example.com",
    summary: "Focused engineer.",
  },
  work: [
    {
      name: "Acme",
      position: "Engineer",
      startDate: "2020-01-01",
      endDate: "2022-06-01",
    },
  ],
  skills: [{ name: "TypeScript" }],
};

describe("renderTheme", () => {
  it("renders each of the 9 registered themes to a non-empty HTML string", () => {
    const names = Object.keys(themes) as Array<keyof typeof themes>;
    expect(names).toHaveLength(9);
    for (const name of names) {
      const html = renderTheme(name, sampleResume);
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
      expect(html.toLowerCase()).toContain("<html");
    }
  });

  it("throws 'Unknown theme' for an unregistered name", () => {
    expect(() =>
      // deliberately invalid theme name
      renderTheme("nope" as keyof typeof themes, sampleResume),
    ).toThrow(/Unknown theme/);
  });

  it("includes provided resume field values in the output", () => {
    const html = renderTheme("simple", sampleResume);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Senior Engineer");
  });

  it("does not HTML-escape the base64 image via the safeImage helper", () => {
    const template = Handlebars.compile("{{safeImage img}}");
    const img = "data:image/png;base64,ABC/==+xyz&more";
    const out = template({ img });
    expect(out).toBe(img);
    expect(out).not.toContain("&amp;");
  });
});

describe("Handlebars helpers", () => {
  it("paragraphSplit wraps each non-empty line in <p>…</p>", () => {
    const template = Handlebars.compile("{{paragraphSplit text}}");
    const out = template({ text: "line one\nline two" });
    expect(out).toBe("<p>line one</p><p>line two</p>");
  });

  it("paragraphSplit skips blank lines", () => {
    const template = Handlebars.compile("{{paragraphSplit text}}");
    const out = template({ text: "line one\n\nline two\n" });
    expect(out).toBe("<p>line one</p><p>line two</p>");
  });

  it("toLowerCase lowercases a string", () => {
    const template = Handlebars.compile("{{toLowerCase text}}");
    expect(template({ text: "HeLLo" })).toBe("hello");
  });

  it("spaceToDash replaces spaces with dashes and lowercases", () => {
    const template = Handlebars.compile("{{spaceToDash text}}");
    expect(template({ text: "Full Stack Developer" })).toBe(
      "full-stack-developer",
    );
  });

  it("MY formats a date as 'MMMM YYYY' in French locale", () => {
    const template = Handlebars.compile("{{MY date}}");
    expect(template({ date: "2022-01-15" })).toBe("janvier 2022");
  });

  it("Y formats a date as 'YYYY'", () => {
    const template = Handlebars.compile("{{Y date}}");
    expect(template({ date: "2022-01-15" })).toBe("2022");
  });

  it("DMY formats a date as 'D MMMM YYYY' in French locale", () => {
    const template = Handlebars.compile("{{DMY date}}");
    expect(template({ date: "2022-01-15" })).toBe("15 janvier 2022");
  });
});

describe("themes registry (themes/index.ts)", () => {
  it("exposes exactly 9 themes", () => {
    expect(Object.keys(themes)).toHaveLength(9);
  });

  it("includes 'modern-sidebar' (the fallback default)", () => {
    expect(themes).toHaveProperty("modern-sidebar");
  });
});
