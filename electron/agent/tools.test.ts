/**
 * Tier 2 — contract parity between the declared tools and their dispatcher.
 *
 * The 10 tool names declared in tools.ts MUST match the switch cases handled by
 * `executeTool` in main.ts. If they drift, the agent advertises a tool it can't
 * run (or vice-versa). Rather than importing main.ts (which pulls in the whole
 * Electron main process), we parse the `executeTool` switch cases out of the
 * source file and assert them against the declared tool list.
 *
 * See tests/TEST_PLAN.md → "Tier 2: tools ↔ executeTool parity".
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import type OpenAI from "openai";
import { tools } from "./tools";

const EXPECTED_TOOL_NAMES = [
  "read_file",
  "save_candidature_config",
  "write_file",
  "generate_resume_files",
  "render_resume_html",
  "fetch_url",
  "save_source_resume",
  "read_pdf",
  "analyze_job_offer",
  "write_motivation_letter",
].sort();

/** Extract the string literals used as `case "…":` inside executeTool. */
function extractExecuteToolCases(): string[] {
  // Vitest runs with cwd at the repo root; resolve main.ts from there so we
  // avoid import.meta (disallowed by the electron tsconfig module setting).
  const mainSrc = readFileSync(
    path.resolve(process.cwd(), "electron", "main.ts"),
    "utf8",
  );
  const start = mainSrc.indexOf("async function executeTool");
  expect(start).toBeGreaterThan(-1);
  const end = mainSrc.indexOf("return { result, updatedResume", start);
  expect(end).toBeGreaterThan(start);
  const body = mainSrc.slice(start, end);
  const cases = new Set<string>();
  const re = /case\s+"([^"]+)":/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    cases.add(m[1]);
  }
  return [...cases];
}

function toolName(t: OpenAI.Chat.ChatCompletionTool): string {
  return t.type === "function" ? t.function.name : "";
}

describe("agent tools contract", () => {
  it("declares exactly the expected 10 tools by name", () => {
    const names = tools.map(toolName).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it("every declared tool name has a matching case in executeTool", () => {
    const cases = new Set(extractExecuteToolCases());
    for (const t of tools) {
      expect(cases.has(toolName(t))).toBe(true);
    }
  });

  it("every executeTool case corresponds to a declared tool (no orphans)", () => {
    const declared = new Set(tools.map(toolName));
    for (const c of extractExecuteToolCases()) {
      expect(declared.has(c)).toBe(true);
    }
  });

  it("each tool has a non-empty French description and a valid parameters schema", () => {
    for (const t of tools) {
      expect(t.type).toBe("function");
      if (t.type !== "function") continue;
      expect(t.function.description).toBeTruthy();
      expect((t.function.description ?? "").length).toBeGreaterThan(0);
      const params = t.function.parameters as
        | { type?: string; properties?: Record<string, unknown> }
        | undefined;
      expect(params?.type).toBe("object");
      expect(params?.properties).toBeTypeOf("object");
    }
  });

  it("render_resume_html requires company and position string params (AC-1)", () => {
    const tool = tools.find((t) => toolName(t) === "render_resume_html");
    expect(tool?.type).toBe("function");
    if (tool?.type !== "function") return;
    const params = tool.function.parameters as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
    expect(params.required).toEqual(
      expect.arrayContaining(["resumeJson", "company", "position"]),
    );
    expect(params.properties?.company?.type).toBe("string");
    expect(params.properties?.position?.type).toBe("string");
  });

  it("analyze_job_offer's schema allows either url/text without requiring both (AC-2)", () => {
    const tool = tools.find((t) => toolName(t) === "analyze_job_offer");
    expect(tool?.type).toBe("function");
    if (tool?.type !== "function") return;
    const params = tool.function.parameters as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
    expect(params.properties?.url?.type).toBe("string");
    expect(params.properties?.text?.type).toBe("string");
    expect(params.required ?? []).not.toEqual(
      expect.arrayContaining(["url", "text"]),
    );
  });
});
