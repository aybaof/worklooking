/**
 * Manual, real-Electron verification for the multi-page PDF rendering fix
 * (`.work/features/resume-multipage-render-fix/`).
 *
 * This is intentionally NOT a Vitest test and is NOT wired into `npm test`/CI:
 * it boots a real (headless) Electron `app`, imports the real, unmocked
 * `generatePdf` (from `electron/main.ts`) and `renderTheme` (from
 * `electron/themes/shared/render.ts`), and exercises the actual
 * `printToPDF`/pagination code path against synthetic long/short resume
 * fixtures — proving AC1-AC4 behaviorally, which Vitest's mocked
 * `electron/main.integration.test.ts` harness cannot do (see plan.md's "Test
 * strategy" section for why).
 *
 * Run with:
 *   npm run verify:pdf
 *
 * On success, prints a PASS line per assertion and exits 0. On any failure,
 * prints the failure and exits 1 (via Node's `assert`, which throws).
 *
 * Fabricated, non-PII resume data only — no real user data is used.
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { app } from "electron";
import { PDFParse } from "pdf-parse";

import { generatePdf } from "../electron/main";
import { renderTheme } from "../electron/themes/shared/render";
import type { ThemeName } from "../electron/themes/index";
import type { Resume } from "../shared/resume-types";
import type { PageMode } from "../shared/pageFit";

function buildLongResume(): Resume {
  const work = Array.from({ length: 15 }, (_, i) => ({
    name: `Fabricated Test Company ${i + 1}`,
    position: `Senior Test Engineer ${i + 1}`,
    startDate: `${2010 + i}-01-01`,
    endDate: `${2011 + i}-01-01`,
    summary:
      "This is a fabricated, non-PII test entry used only to generate a " +
      "synthetic long resume fixture for the multi-page PDF verification " +
      "script. It repeats deliberately to push total content past one A4 " +
      "page's worth of vertical space across every theme.",
    highlights: [
      `Highlight one for fabricated entry ${i + 1}, describing a made-up accomplishment in enough detail to take up a full line of text.`,
      `Highlight two for fabricated entry ${i + 1}, again purely synthetic filler content for layout-testing purposes only.`,
      `Highlight three for fabricated entry ${i + 1}, ensuring each work entry has substantial multi-line content.`,
    ],
  }));

  return {
    basics: {
      name: "Test Fixture Person",
      label: "Fabricated Test Persona",
      email: "test-fixture@example.invalid",
      phone: "+00 000 000 000",
      summary:
        "Fabricated summary paragraph for the verify-multipage-pdf.ts script. " +
        "Not a real person; not real PII. Used solely to produce a resume " +
        "long enough to require multiple A4 pages when rendered.",
      location: { city: "Nowhere", countryCode: "XX" },
    },
    work,
    education: [
      {
        institution: "Fabricated Test University",
        area: "Test Studies",
        studyType: "Bachelor",
        startDate: "2005-09-01",
        endDate: "2009-06-01",
      },
    ],
    skills: [
      { name: "Testing", level: "Expert", keywords: ["Fixtures", "Fabrication"] },
    ],
    languages: [{ language: "English", fluency: "Native" }],
    interests: [{ name: "Synthetic data" }],
  };
}

function buildShortResume(): Resume {
  return {
    basics: {
      name: "Short Fixture Person",
      label: "Fabricated Short Test Persona",
      email: "short-fixture@example.invalid",
      summary: "A short, fabricated resume fixture that fits one A4 page.",
    },
    work: [
      {
        name: "Fabricated Test Company",
        position: "Test Engineer",
        startDate: "2020-01-01",
        endDate: "2022-01-01",
        summary: "One short, fabricated role.",
        highlights: ["A single fabricated highlight."],
      },
    ],
  };
}

async function renderToTempHtml(
  themeName: ThemeName,
  resume: Resume,
  label: string,
): Promise<string> {
  const html = renderTheme(themeName, resume);
  const htmlPath = path.join(
    os.tmpdir(),
    `worklooking-verify-pdf-${themeName}-${label}-${Date.now()}.html`,
  );
  fs.writeFileSync(htmlPath, html, "utf-8");
  return htmlPath;
}

async function generateAndParse(
  themeName: ThemeName,
  resume: Resume,
  label: string,
  pageMode: PageMode,
): Promise<{ numpages: number; pageTexts: string[] }> {
  const htmlPath = await renderToTempHtml(themeName, resume, label);
  const pdfPath = path.join(
    os.tmpdir(),
    `worklooking-verify-pdf-${themeName}-${label}-${Date.now()}.pdf`,
  );

  const result = await generatePdf({ htmlPath, pdfPath, pageMode });
  assert(result.success, `generatePdf failed for ${themeName}/${label}: ${result.error}`);

  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const info = await parser.getText();
  await parser.destroy();

  // pdf-parse's per-page text isn't uniformly shaped across versions; fall
  // back to splitting on form-feed if a `pages` array isn't present.
  const anyInfo = info as unknown as {
    numpages?: number;
    total?: number;
    pages?: Array<{ text?: string }>;
    text?: string;
  };
  const numpages = anyInfo.numpages ?? anyInfo.total ?? 1;
  const pageTexts =
    anyInfo.pages?.map((p) => p.text ?? "") ??
    (anyInfo.text ?? "").split("\f");

  return { numpages, pageTexts };
}

async function main() {
  await app.whenReady();

  const long = buildLongResume();
  const short = buildShortResume();

  const results: string[] = [];

  // AC1 + AC2: long resume, multi-page mode, 2+ pages, distinct page-2 content.
  const acThemes: ThemeName[] = ["modern-sidebar", "professional", "spartan-fr"];
  for (const themeName of acThemes) {
    const { numpages, pageTexts } = await generateAndParse(
      themeName,
      long,
      "long-multipage",
      "multi-page",
    );
    assert(
      numpages >= 2,
      `[FAIL] ${themeName}: expected >= 2 pages in multi-page mode, got ${numpages}`,
    );
    const page2 = (pageTexts[1] ?? "").trim();
    assert(
      page2.length > 0,
      `[FAIL] ${themeName}: page 2 text is empty`,
    );
    assert(
      page2 !== (pageTexts[0] ?? "").trim(),
      `[FAIL] ${themeName}: page 2 text is identical to page 1 (likely still clipped)`,
    );
    results.push(
      `[PASS] ${themeName}: long resume, multi-page -> ${numpages} pages, distinct page-2 content`,
    );
  }

  // AC3: long resume, one-page mode (regression) -> exactly 1 page.
  {
    const themeName = "modern-sidebar";
    const { numpages } = await generateAndParse(
      themeName,
      long,
      "long-onepage",
      "one-page",
    );
    assert(
      numpages === 1,
      `[FAIL] ${themeName}: expected exactly 1 page in one-page mode, got ${numpages}`,
    );
    results.push(
      `[PASS] ${themeName}: long resume, one-page mode -> exactly 1 page (shrink-to-fit unaffected)`,
    );
  }

  // AC4: short resume, multi-page mode (regression) -> exactly 1 page.
  {
    const themeName = "modern-sidebar";
    const { numpages } = await generateAndParse(
      themeName,
      short,
      "short-multipage",
      "multi-page",
    );
    assert(
      numpages === 1,
      `[FAIL] ${themeName}: expected exactly 1 page for short resume in multi-page mode, got ${numpages}`,
    );
    results.push(
      `[PASS] ${themeName}: short resume, multi-page mode -> exactly 1 page (no regression)`,
    );
  }

  console.log("\nverify-multipage-pdf.ts results:\n");
  for (const line of results) console.log(line);
  console.log(
    "\nAll assertions passed. Inspect the generated PDFs in your OS temp " +
      "directory to visually confirm modern-sidebar's sidebar background " +
      "extends the full page height on page 2 (AC5b) and no decorative " +
      "elements are misplaced (see plan.md Risks).",
  );

  app.exit(0);
}

main().catch((error) => {
  console.error("\nverify-multipage-pdf.ts FAILED:\n");
  console.error(error);
  app.exit(1);
});
