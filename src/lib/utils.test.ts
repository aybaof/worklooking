/**
 * Tier 1 — cn() class-name merge helper.
 * See tests/TEST_PLAN.md → "Tier 1: cn".
 */
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins multiple class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("supports conditional/object class maps", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});
