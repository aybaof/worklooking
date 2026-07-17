/**
 * Tier 1 — pure functions extracted from electron/main.ts
 *
 * `validateAndSanitizePath` (+ `IPCError`), `detectsAuthRequired`, and
 * `shouldFallBackToVisible` were extracted into `electron/lib/paths.ts`,
 * `electron/lib/auth-detect.ts`, and `electron/lib/fetch-fallback.ts` so
 * they can be unit-tested without importing the whole Electron main
 * process. See tests/TEST_PLAN.md → "Tier 1: main.ts" and docs/architecture.md.
 */
import path from "path";
import { describe, it, expect } from "vitest";
import { ErrorCodes } from "../shared/ipc";
import { IPCError, validateAndSanitizePath } from "./lib/paths";
import { detectsAuthRequired } from "./lib/auth-detect";
import { shouldFallBackToVisible } from "./lib/fetch-fallback";

describe("validateAndSanitizePath", () => {
  const basePath = path.resolve("/base/dir");

  it("returns an absolute path when given a relative path under basePath", () => {
    const result = validateAndSanitizePath("sub/file.txt", basePath);
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.join(basePath, "sub", "file.txt"));
  });

  it("accepts an already-absolute path inside basePath", () => {
    const absInside = path.join(basePath, "nested", "file.txt");
    const result = validateAndSanitizePath(absInside, basePath);
    expect(result).toBe(path.normalize(absInside));
  });

  it("throws IPCError(INVALID_PATH) on directory traversal ('../')", () => {
    try {
      validateAndSanitizePath("../../etc/passwd", basePath);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(IPCError);
      expect((e as IPCError).code).toBe(ErrorCodes.INVALID_PATH);
    }
  });

  it("throws IPCError(INVALID_PATH) on empty / whitespace input", () => {
    try {
      validateAndSanitizePath("", basePath);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(IPCError);
      expect((e as IPCError).code).toBe(ErrorCodes.INVALID_PATH);
      expect((e as IPCError).message).toBe("Path is required");
    }
  });

  it("normalizes redundant separators and '.' segments", () => {
    const result = validateAndSanitizePath("sub/./inner/file.txt", basePath);
    expect(result).toBe(path.join(basePath, "sub", "inner", "file.txt"));
  });

  it("blocks escaping basePath via a relative path that climbs out", () => {
    try {
      validateAndSanitizePath("sub/../../outside/file.txt", basePath);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(IPCError);
      expect((e as IPCError).code).toBe(ErrorCodes.INVALID_PATH);
      expect((e as IPCError).message).toBe("Path traversal not allowed");
    }
  });
});

describe("detectsAuthRequired", () => {
  it("returns true when the final URL contains an auth path (e.g. /login)", () => {
    expect(
      detectsAuthRequired(
        "https://example.com/jobs/123",
        "https://example.com/login",
        "Example",
      ),
    ).toBe(true);
  });

  it("returns true on cross-domain redirect to a host containing 'login'", () => {
    expect(
      detectsAuthRequired(
        "https://example.com/jobs/123",
        "https://accounts.other.com/?redir=login",
        "Redirecting",
      ),
    ).toBe(true);
  });

  it("returns true when the page title mentions sign in / connexion", () => {
    expect(
      detectsAuthRequired(
        "https://example.com/jobs/123",
        "https://example.com/jobs/123",
        "Please Sign In to continue",
      ),
    ).toBe(true);
  });

  it("returns false for a normal same-domain navigation", () => {
    expect(
      detectsAuthRequired(
        "https://example.com/jobs/123",
        "https://example.com/jobs/123/details",
        "Software Engineer — Example",
      ),
    ).toBe(false);
  });

  it("returns false when initial and final URLs match and title is benign", () => {
    expect(
      detectsAuthRequired(
        "https://example.com/jobs/123",
        "https://example.com/jobs/123",
        "Software Engineer — Example",
      ),
    ).toBe(false);
  });
});

describe("shouldFallBackToVisible", () => {
  it("returns true when the hidden load timed out (AC-2)", () => {
    expect(
      shouldFallBackToVisible({ hiddenLoadTimedOut: true, needsAuth: false }),
    ).toBe(true);
  });

  it("returns true when detectsAuthRequired flagged the page (AC-3)", () => {
    expect(
      shouldFallBackToVisible({ hiddenLoadTimedOut: false, needsAuth: true }),
    ).toBe(true);
  });

  it("returns true when both the timeout and the auth heuristic fire", () => {
    expect(
      shouldFallBackToVisible({ hiddenLoadTimedOut: true, needsAuth: true }),
    ).toBe(true);
  });

  it("returns false when neither reason applies — no regression to the happy path (AC-1)", () => {
    expect(
      shouldFallBackToVisible({ hiddenLoadTimedOut: false, needsAuth: false }),
    ).toBe(false);
  });
});
