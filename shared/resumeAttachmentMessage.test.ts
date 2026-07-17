/**
 * Tier: node/pure. Covers `buildResumeAttachmentMessage` (AC-5, AC-6) — the
 * one assistant message posted to the main conversation on a FULL
 * `validate()` success. Runs in the `node` Vitest project (`shared/**`).
 */
import { describe, it, expect } from "vitest";
import { buildResumeAttachmentMessage } from "./resumeAttachmentMessage";

describe("buildResumeAttachmentMessage", () => {
  const input = {
    company: "Doctolib",
    position: "Développeur Fullstack",
    htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
    pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
  };

  it("content is non-empty and contains company/position/htmlPath/pdfPath (AC-5)", () => {
    const message = buildResumeAttachmentMessage(input);

    expect(message.content).toBeTruthy();
    expect(message.content).toContain(input.company);
    expect(message.content).toContain(input.position);
    expect(message.content).toContain(input.htmlPath);
    expect(message.content).toContain(input.pdfPath);
  });

  it("content is French, not English placeholder text (AC-5)", () => {
    const message = buildResumeAttachmentMessage(input);

    expect(message.content).not.toMatch(/^Generated/i);
    expect(message.content ?? "").toMatch(/généré/i);
  });

  it("role is 'assistant' and origin is undefined (AC-6)", () => {
    const message = buildResumeAttachmentMessage(input);

    expect(message.role).toBe("assistant");
    expect(message.origin).toBeUndefined();
  });

  it("attachment mirrors the input exactly", () => {
    const message = buildResumeAttachmentMessage(input);

    expect(message.attachment).toEqual({
      company: input.company,
      position: input.position,
      htmlPath: input.htmlPath,
      pdfPath: input.pdfPath,
    });
  });
});
