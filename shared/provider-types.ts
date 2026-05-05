export interface ProviderPreset {
  id: string;
  name: string;
  baseURL: string;
  models: string[];
  requiresApiKey: boolean;
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
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    requiresApiKey: true,
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    models: [],
    requiresApiKey: false,
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseURL: "",
    models: [],
    requiresApiKey: false,
  },
];

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
