/**
 * Tier 1 — pure helper, no Electron/Node I/O.
 *
 * See tests/TEST_PLAN.md → "Tier 1: letterPlaceholders.ts".
 */
import { describe, it, expect } from "vitest";
import {
  substituteLetterPlaceholders,
  LETTER_PLACEHOLDER_TOKENS,
} from "./letterPlaceholders";

describe("substituteLetterPlaceholders", () => {
  it("replaces all 4 placeholders when source fields are present (AC-11)", () => {
    const letter = [
      "[Votre nom]",
      "[Votre email]",
      "[Votre téléphone]",
      "[Votre adresse]",
      "",
      "Madame, Monsieur,",
    ].join("\n");

    const result = substituteLetterPlaceholders(letter, {
      name: "Alice Dupont",
      email: "alice@example.com",
      phone: "0600000000",
      location: { city: "Paris", postalCode: "75001", countryCode: "FR" },
    });

    expect(result).toContain("Alice Dupont");
    expect(result).toContain("alice@example.com");
    expect(result).toContain("0600000000");
    expect(result).toContain("Paris");
    expect(result).not.toMatch(/\[Votre [^\]]*\]/);
  });

  it("drops the whole line when a field is missing, preserving other lines (AC-12)", () => {
    const letter = [
      "Madame, Monsieur,",
      "Téléphone : [Votre téléphone]",
      "Cordialement,",
      "[Votre nom]",
    ].join("\n");

    const result = substituteLetterPlaceholders(letter, {
      name: "Alice Dupont",
      email: "alice@example.com",
      // phone missing
      location: { city: "Paris" },
    });

    expect(result).not.toContain("Téléphone :");
    expect(result).not.toMatch(/\[Votre [^\]]*\]/);
    expect(result).toContain("Madame, Monsieur,");
    expect(result).toContain("Cordialement,");
    expect(result).toContain("Alice Dupont");
  });

  it("collapses consecutive blank lines left after a drop into a single blank line", () => {
    const letter = ["Ligne 1", "[Votre téléphone]", "Ligne 3"].join("\n");
    const result = substituteLetterPlaceholders(letter, undefined);
    expect(result.split("\n")).toEqual(["Ligne 1", "Ligne 3"]);
  });

  it("treats every token as missing when basics is entirely absent", () => {
    const letter = [
      "[Votre nom]",
      "[Votre email]",
      "[Votre téléphone]",
      "[Votre adresse]",
      "Cordialement,",
    ].join("\n");
    const result = substituteLetterPlaceholders(letter, undefined);
    expect(result).not.toMatch(/\[Votre [^\]]*\]/);
    expect(result.split("\n")).toEqual(["Cordialement,"]);
  });

  it("drops a line where the token is embedded mid-sentence with other content", () => {
    const letter = [
      "Vous pouvez me joindre au [Votre téléphone] ou par courrier.",
      "Cordialement,",
    ].join("\n");
    const result = substituteLetterPlaceholders(letter, {});
    expect(result).toBe("Cordialement,");
  });

  it("exposes the exact literal token constants", () => {
    expect(LETTER_PLACEHOLDER_TOKENS).toEqual({
      name: "[Votre nom]",
      email: "[Votre email]",
      phone: "[Votre téléphone]",
      location: "[Votre adresse]",
    });
  });
});
