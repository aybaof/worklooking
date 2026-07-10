/**
 * Tier 2 — contract parity between the declared tools and their dispatcher.
 *
 * The 7 tool names declared in tools.ts MUST match the switch cases handled by
 * `executeTool` in main.ts. If they drift, the agent advertises a tool it can't
 * run (or vice-versa). Extracting the tool-name→handler map out of main.ts into
 * a small module would make this assertion cleaner; otherwise assert the
 * declared list against a hard-coded expected set and keep it in sync.
 *
 * See tests/TEST_PLAN.md → "Tier 2: tools ↔ executeTool parity".
 */
import { describe, it } from "vitest";
// import { tools } from "./tools";

describe("agent tools contract", () => {
  it.todo("declares exactly the expected 7 tools by name");
  it.todo("every declared tool name has a matching case in executeTool");
  it.todo("every executeTool case corresponds to a declared tool (no orphans)");
  it.todo("each tool has a non-empty French description and a valid parameters schema");
});
