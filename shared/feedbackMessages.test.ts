/**
 * Tier: node/pure. Asserts the French message format and — critically — that no
 * PII field values leak into the regeneration message (AC-8, AC-15). Runs in the
 * `node` Vitest project (`shared/**`).
 */
import { describe, it, expect } from "vitest";
import {
  buildRegenerationMessage,
  buildValidationMessage,
  SectionComment,
} from "./feedbackMessages";

describe("buildRegenerationMessage", () => {
  it("emits the French 'Ajuste les sections suivantes' format with labels + comments (AC-15)", () => {
    const comments: SectionComment[] = [
      { sectionId: "work", comment: "Trop long, résume" },
      { sectionId: "skills", comment: "Ajoute React" },
    ];
    const message = buildRegenerationMessage(comments);

    expect(message).toContain("Ajuste les sections suivantes");
    expect(message).toContain("Expérience professionnelle : Trop long, résume");
    expect(message).toContain("Compétences : Ajoute React");
  });

  it("includes a French PII-free scoping hint to change only the listed sections (AC-9)", () => {
    const comments: SectionComment[] = [
      { sectionId: "work", comment: "Trop long, résume" },
    ];
    const message = buildRegenerationMessage(comments);

    // Non-authoritative hint telling the LLM to touch only the listed sections
    // and leave everything else (incl. PII) unchanged.
    expect(message).toContain("Modifie UNIQUEMENT les sections listées");
    expect(message.toLowerCase()).toContain("inchangées");
    // The hint itself introduces no field values — only fixed instruction text.
    expect(message).not.toContain("Jean Dupont");
    expect(message).not.toContain("jean.dupont@example.com");
  });

  it("ignores comments that are blank", () => {
    const comments: SectionComment[] = [
      { sectionId: "work", comment: "   " },
      { sectionId: "skills", comment: "Ajoute React" },
    ];
    const message = buildRegenerationMessage(comments);
    expect(message).not.toContain("Expérience professionnelle");
    expect(message).toContain("Compétences : Ajoute React");
  });

  it("contains NO PII field values even when the resume is full of PII (AC-8)", () => {
    // Simulate the values a caller must never pass in. The builder only takes
    // section ids/labels + comment text, so none of these can appear.
    const piiValues = [
      "Jean Dupont",
      "jean.dupont@example.com",
      "+33 6 12 34 56 78",
      "12 rue de Paris",
      "https://linkedin.com/in/jeandupont",
      "data:image/png;base64,AAAA",
    ];

    const comments: SectionComment[] = [
      { sectionId: "summary", comment: "Rends le profil plus percutant" },
      { sectionId: "work", comment: "Mets en avant le leadership" },
    ];
    const message = buildRegenerationMessage(comments);

    for (const pii of piiValues) {
      expect(message).not.toContain(pii);
    }
  });
});

describe("buildValidationMessage", () => {
  it("produces a French validation message mentioning file generation (AC-9)", () => {
    const message = buildValidationMessage();
    expect(message.toLowerCase()).toContain("génère");
    expect(message.toLowerCase()).toContain("fichiers");
  });

  it("is an explicit final confirmation: names the tool, HTML+PDF, and forbids re-asking (AC-9)", () => {
    const message = buildValidationMessage();
    const lower = message.toLowerCase();

    // Explicit definitive validation so the agent does not ask again.
    expect(lower).toContain("valide définitivement");
    // Instructs the agent to act NOW.
    expect(lower).toContain("maintenant");
    // Names the exact tool and the two final artifacts.
    expect(message).toContain("generate_resume_files");
    expect(lower).toContain("html");
    expect(lower).toContain("pdf");
    // Leaves no room to re-ask for confirmation.
    expect(lower).toContain("sans me redemander de confirmation");
  });

  it("contains NO PII field values (AC-15)", () => {
    const message = buildValidationMessage();
    const piiValues = [
      "Jean Dupont",
      "jean.dupont@example.com",
      "+33 6 12 34 56 78",
      "12 rue de Paris",
      "https://linkedin.com/in/jeandupont",
      "data:image/png;base64,AAAA",
    ];
    for (const pii of piiValues) {
      expect(message).not.toContain(pii);
    }
  });
});
