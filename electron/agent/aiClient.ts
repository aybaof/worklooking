import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./tools";
import { ProviderApi } from "../../shared/provider-types";

/**
 * Result of running a full agent turn (including any tool-call loop).
 */
export interface ChatRunResult {
  content: string;
}

/**
 * Callback the router uses to run a single tool. The caller (main process)
 * owns the actual tool implementations and IPC plumbing; the router only
 * knows how to ask for a tool to be executed and to receive its JSON result.
 */
export type ToolRunner = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Callback used to stream partial assistant text back to the renderer.
 */
export type TextEmitter = (content: string) => void;

export interface ChatRunOptions {
  apiKey: string;
  model: string;
  baseURL: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string | null }>;
  runTool: ToolRunner;
  emitText: TextEmitter;
}

export interface TestConnectionOptions {
  apiKey: string;
  model: string;
  baseURL: string;
}

/**
 * Common interface implemented by each provider adapter. Keeping this behind
 * an interface lets `AiClientRouter` treat OpenAI and Anthropic uniformly.
 */
interface AiProvider {
  runChat(options: ChatRunOptions): Promise<ChatRunResult>;
  testConnection(options: TestConnectionOptions): Promise<void>;
}

const MAX_TOKENS = 8192;

// Azure AI Foundry requires an api-version query parameter on its Anthropic
// passthrough. This is the version the /anthropic/v1/messages route expects.
const AZURE_ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Normalize an Anthropic base URL. The Anthropic SDK always appends
 * "/v1/messages", so the configured base URL must stop *before* that path.
 * Users frequently paste the full endpoint (e.g. ".../anthropic/v1/messages"
 * or ".../anthropic/v1"), so we trim those suffixes to avoid a doubled path
 * (which Azure Foundry rejects with `api_not_supported`).
 */
export function normalizeAnthropicBaseURL(baseURL: string): string {
  if (!baseURL) return baseURL;
  let url = baseURL.trim().replace(/\/+$/, "");
  url = url.replace(/\/v1\/messages$/i, "");
  url = url.replace(/\/v1$/i, "");
  return url;
}

/** True when the endpoint is an Azure AI Foundry / Cognitive Services host. */
function isAzureEndpoint(baseURL: string): boolean {
  return /\.(azure\.com|cognitive\.microsoft\.com|services\.ai\.azure\.com)/i.test(
    baseURL,
  );
}

// --- OpenAI (Chat Completions) adapter ---
class OpenAIProvider implements AiProvider {
  private clientFor(apiKey: string, baseURL: string): OpenAI {
    return new OpenAI({ apiKey: apiKey || "ollama", baseURL });
  }

  async runChat(options: ChatRunOptions): Promise<ChatRunResult> {
    const { apiKey, baseURL, model, systemPrompt, messages, runTool, emitText } =
      options;
    const client = this.clientFor(apiKey, baseURL);

    const currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(messages as OpenAI.Chat.ChatCompletionMessageParam[]),
    ];

    let response = await client.chat.completions.create({
      model,
      messages: currentMessages,
      tools,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No response from AI agent");
    }

    let assistantMessage = response.choices[0].message;

    while (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0
    ) {
      if (assistantMessage.content) {
        emitText(assistantMessage.content);
      }
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const args = JSON.parse(toolCall.function.arguments);
        const result = await runTool(toolCall.function.name, args);
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      response = await client.chat.completions.create({
        model,
        messages: currentMessages,
        tools,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from AI agent during tool execution");
      }
      assistantMessage = response.choices[0].message;
    }

    return { content: assistantMessage.content || "No content returned" };
  }

  async testConnection(options: TestConnectionOptions): Promise<void> {
    const client = this.clientFor(options.apiKey, options.baseURL);
    await client.chat.completions.create({
      model: options.model,
      messages: [{ role: "user", content: "Say hi" }],
      max_tokens: 5,
    });
  }
}

// --- Anthropic (Messages API) adapter ---
class AnthropicProvider implements AiProvider {
  // Convert the OpenAI-style tool definitions into Anthropic's schema once.
  private static anthropicTools: Anthropic.Tool[] = tools
    .filter(
      (t): t is OpenAI.Chat.ChatCompletionFunctionTool =>
        t.type === "function",
    )
    .map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: (t.function.parameters ?? {
        type: "object",
        properties: {},
      }) as Anthropic.Tool.InputSchema,
    }));

  private clientFor(apiKey: string, baseURL: string): Anthropic {
    const normalized = normalizeAnthropicBaseURL(baseURL);
    const azure = isAzureEndpoint(normalized);

    return new Anthropic({
      apiKey: apiKey || "unused",
      baseURL: normalized || undefined,
      // Azure Foundry authenticates via the api-key header and requires an
      // api-version query parameter on the passthrough route.
      defaultQuery: azure
        ? { "api-version": AZURE_ANTHROPIC_API_VERSION }
        : undefined,
      defaultHeaders: azure ? { "api-key": apiKey } : undefined,
    });
  }

  async runChat(options: ChatRunOptions): Promise<ChatRunResult> {
    const { apiKey, baseURL, model, systemPrompt, messages, runTool, emitText } =
      options;
    const client = this.clientFor(apiKey, baseURL);
    const anthropicTools = AnthropicProvider.anthropicTools;

    // Anthropic takes the system prompt as a top-level field, so system
    // messages in the history are dropped here.
    const currentMessages: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== "system" && m.content != null)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content),
      }));

    let response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: currentMessages,
      tools: anthropicTools,
    });

    while (response.stop_reason === "tool_use") {
      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          emitText(block.text);
        }
      }

      // Echo the assistant turn (text + tool_use blocks) back verbatim.
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const args = block.input as Record<string, unknown>;
        const result = await runTool(block.name, args);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      // Tool results are delivered as a single user turn.
      currentMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: currentMessages,
        tools: anthropicTools,
      });
    }

    const finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return { content: finalText || "No content returned" };
  }

  async testConnection(options: TestConnectionOptions): Promise<void> {
    const client = this.clientFor(options.apiKey, options.baseURL);
    await client.messages.create({
      model: options.model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Say hi" }],
    });
  }
}

/**
 * Singleton that routes chat / connection requests to the correct provider
 * adapter based on the wire protocol. Provider adapters are stateless and
 * built once; per-request clients are created inside each adapter.
 */
export class AiClientRouter {
  private static instance: AiClientRouter | null = null;

  private readonly providers: Record<ProviderApi, AiProvider> = {
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
  };

  private constructor() {}

  static getInstance(): AiClientRouter {
    if (!AiClientRouter.instance) {
      AiClientRouter.instance = new AiClientRouter();
    }
    return AiClientRouter.instance;
  }

  private resolve(api: ProviderApi | undefined): AiProvider {
    return this.providers[api === "anthropic" ? "anthropic" : "openai"];
  }

  runChat(
    api: ProviderApi | undefined,
    options: ChatRunOptions,
  ): Promise<ChatRunResult> {
    return this.resolve(api).runChat(options);
  }

  testConnection(
    api: ProviderApi | undefined,
    options: TestConnectionOptions,
  ): Promise<void> {
    return this.resolve(api).testConnection(options);
  }
}
