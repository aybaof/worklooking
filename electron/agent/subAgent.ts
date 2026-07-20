import type { ToolRunner } from "./aiClient";
import { AiClientRouter } from "./aiClient";
import { tools } from "./tools";
import type { ProviderApi } from "../../shared/provider-types";

/**
 * Options for a single specialist sub-agent run. Deliberately has NO
 * `event`/`IpcMainInvokeEvent`/renderer-facing field at all, so there is no
 * way for a sub-agent round to reach `chat:update`/`tool:status` even by
 * mistake.
 */
export interface SubAgentOptions {
  apiKey: string;
  model: string;
  baseURL: string;
  api?: ProviderApi;
  /** The specialist's own narrow system prompt. */
  systemPrompt: string;
  /** The specialist's own single task input — never the main conversation history. */
  userInput: string;
  /** Narrow subset of the base tool names this specialist may call. */
  allowedTools: string[];
  /** Same `ToolRunner` shape as the main loop, scoped to `allowedTools`. */
  runTool: ToolRunner;
}

export interface SubAgentResult {
  success: boolean;
  content?: string;
  error?: string;
}

/** Hard iteration cap: 5 tool-call rounds (spec §3). */
export const SUB_AGENT_MAX_ROUNDS = 5;

/**
 * Runs a short, silent, capped tool-calling loop for a specialist sub-agent
 * tool (e.g. `analyze_job_offer`, `write_motivation_letter`). Delegates
 * entirely to `AiClientRouter` — no provider-specific code of its own — so
 * it stays a thin, provider-agnostic caller.
 *
 * Never throws: hard provider/network errors and hitting the round cap both
 * resolve to a structured `{ success: false, error }` result.
 */
export async function runSubAgent(
  options: SubAgentOptions,
): Promise<SubAgentResult> {
  const messages = [{ role: "user", content: options.userInput }];

  // Defense-in-depth alongside the `toolDefs` schema restriction below:
  // reject (without ever invoking the real tool) any tool name not present
  // in `allowedTools`, in case the schema restriction is ever bypassed.
  const scopedRunTool: ToolRunner = async (name, args) => {
    if (!options.allowedTools.includes(name)) {
      return {
        success: false,
        error: `Outil "${name}" non disponible pour ce sous-agent.`,
      };
    }
    return options.runTool(name, args);
  };

  const toolDefs = tools.filter(
    (t) => t.type === "function" && options.allowedTools.includes(t.function.name),
  );

  try {
    const result = await AiClientRouter.getInstance().runChat(options.api, {
      apiKey: options.apiKey,
      model: options.model,
      baseURL: options.baseURL,
      systemPrompt: options.systemPrompt,
      messages,
      runTool: scopedRunTool,
      // Sub-agent rounds are silent by design: never forward partial text
      // to the renderer.
      emitText: () => {},
      maxRounds: SUB_AGENT_MAX_ROUNDS,
      toolDefs,
    });

    if (result.cappedOut) {
      return {
        success: false,
        error:
          "Le sous-agent a atteint la limite de tours d'appels d'outils sans produire de réponse finale.",
      };
    }

    return { success: true, content: result.content };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
