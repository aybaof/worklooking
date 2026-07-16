/**
 * Tier: node/pure. Unit tests for the deterministic candidature-folder segment
 * sanitizer: lowercase/hyphenation/underscore-join convention (AC-6) and
 * traversal/unsafe-character neutralization (AC-7).
 */
import { describe, it, expect } from "vitest";
import { deriveCandidatureFolderSegment } from "./candidature-folder";
import { IPCError } from "./paths";
import { ErrorCodes } from "../../shared/ipc";

describe("deriveCandidatureFolderSegment", () => {
  it("matches the documented example convention (AC-6)", () => {
    expect(
      deriveCandidatureFolderSegment("doctolib", "fullstack developer"),
    ).toBe("doctolib_fullstack-developer");
  });

  it("hyphenates multi-word segments on BOTH sides (AC-6)", () => {
    expect(
      deriveCandidatureFolderSegment("Ma Petite Startup", "Lead Product Manager"),
    ).toBe("ma-petite-startup_lead-product-manager");
  });

  it("lowercases and strips accents", () => {
    expect(deriveCandidatureFolderSegment("Numérique", "Développeur")).toBe(
      "numerique_developpeur",
    );
  });

  it("neutralizes traversal sequences and unsafe characters (AC-7)", () => {
    const segment = deriveCandidatureFolderSegment(
      "../../etc",
      "/etc/passwd",
    );
    expect(segment).not.toContain("..");
    expect(segment).not.toContain("/");
    expect(segment).not.toContain("\\");
    expect(segment).toMatch(/^[a-z0-9-]+_[a-z0-9-]+$/);
  });

  it("neutralizes backslashes and null bytes", () => {
    const segment = deriveCandidatureFolderSegment(
      "C:\\Windows\\System32",
      "a\0b",
    );
    expect(segment).not.toContain("\\");
    expect(segment).not.toContain("\0");
    expect(segment).toMatch(/^[a-z0-9-]+_[a-z0-9-]+$/);
  });

  it("throws IPCError(INVALID_PATH) for blank input", () => {
    expect(() => deriveCandidatureFolderSegment("", "position")).toThrow(
      IPCError,
    );
    try {
      deriveCandidatureFolderSegment("", "position");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IPCError);
      expect((err as IPCError).code).toBe(ErrorCodes.INVALID_PATH);
    }
  });

  it("throws IPCError(INVALID_PATH) for whitespace-only input", () => {
    expect(() => deriveCandidatureFolderSegment("   ", "position")).toThrow(
      IPCError,
    );
  });

  it("throws IPCError(INVALID_PATH) for all-unsafe-character input", () => {
    expect(() => deriveCandidatureFolderSegment("///", "company")).toThrow(
      IPCError,
    );
    expect(() => deriveCandidatureFolderSegment("company", "///")).toThrow(
      IPCError,
    );
  });
});
