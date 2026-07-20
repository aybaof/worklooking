/**
 * Tier 1 — pure, string-returning prompt builders (no I/O).
 *
 * See tests/TEST_PLAN.md → "Tier 1: specialistPrompts.ts".
 */
import { describe, it, expect } from "vitest";
import {
  buildAnalyzeJobOfferPrompt,
  buildWriteMotivationLetterPrompt,
} from "./specialistPrompts";

describe("buildAnalyzeJobOfferPrompt", () => {
  it("is a non-empty French string", () => {
    const prompt = buildAnalyzeJobOfferPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("instructs the specialist to never return raw offer text, only structured JSON", () => {
    const prompt = buildAnalyzeJobOfferPrompt();
    expect(prompt).toContain("produire UNIQUEMENT un objet JSON structuré");
    expect(prompt).toContain("Ne retourne JAMAIS le texte brut de l'offre");
  });

  it("includes the anti-hallucination instruction for missing/insufficient offer content", () => {
    const prompt = buildAnalyzeJobOfferPrompt();
    expect(prompt).toContain("N'invente JAMAIS d'entreprise");
  });

  it("scopes fetch_url/read_pdf usage to when explicitly relevant", () => {
    const prompt = buildAnalyzeJobOfferPrompt();
    expect(prompt).toContain("fetch_url");
    expect(prompt).toContain("read_pdf");
  });
});

describe("buildWriteMotivationLetterPrompt", () => {
  it("is a non-empty French string", () => {
    const prompt = buildWriteMotivationLetterPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("includes the anti-hallucination instruction (AC-13)", () => {
    const prompt = buildWriteMotivationLetterPrompt();
    expect(prompt).toContain(
      "N'invente, n'hallucine et n'ajoute JAMAIS d'expérience, de diplôme ou de",
    );
  });

  it("instructs the specialist to use the exact literal placeholder tokens", () => {
    const prompt = buildWriteMotivationLetterPrompt();
    expect(prompt).toContain("[Votre nom]");
    expect(prompt).toContain("[Votre email]");
    expect(prompt).toContain("[Votre téléphone]");
    expect(prompt).toContain("[Votre adresse]");
    expect(prompt).toContain("Ne fabrique et ne devine JAMAIS de vraies valeurs");
  });

  it("specifies the target length and standard French business-letter tone", () => {
    const prompt = buildWriteMotivationLetterPrompt();
    expect(prompt).toContain("250 à 400 mots");
  });
});
