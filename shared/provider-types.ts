export type ProviderApi = "openai" | "anthropic";

export interface ProviderPreset {
  id: string;
  name: string;
  baseURL: string;
  models: string[];
  requiresApiKey: boolean;
  /**
   * Which wire protocol the endpoint speaks. Defaults to "openai" when
   * omitted. The "custom" provider lets the user pick this at runtime.
   */
  api: ProviderApi;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "o3-mini",
    ],
    requiresApiKey: true,
    api: "openai",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    requiresApiKey: true,
    api: "openai",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    models: [],
    requiresApiKey: false,
    api: "openai",
  },
  {
    id: "custom",
    name: "Custom (OpenAI / Anthropic-compatible)",
    baseURL: "",
    models: [],
    requiresApiKey: false,
    api: "openai",
  },
];

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
