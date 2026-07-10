import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderOpen, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Channels } from "@/../shared/ipc";
import type {
  ProviderPreset,
  ProviderApi,
} from "@/../shared/provider-types";

interface IConfigurationPage {
  apiKey: string;
  setApiKey: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  baseURL: string;
  setBaseURL: (v: string) => void;
  api: ProviderApi;
  customApi: ProviderApi;
  setCustomApi: (v: ProviderApi) => void;
  currentPreset: ProviderPreset | undefined;
  providerPresets: ProviderPreset[];
  userDataPath: string;
  onSelectFolder: () => void;
}

type TestStatus = "idle" | "testing" | "success" | "error";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function ConfigurationPage({
  apiKey,
  selectedModel,
  setApiKey,
  setSelectedModel,
  selectedProvider,
  onProviderChange,
  baseURL,
  setBaseURL,
  api,
  customApi,
  setCustomApi,
  currentPreset,
  providerPresets,
  userDataPath,
  onSelectFolder,
}: IConfigurationPage) {
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");

  const hasPresetModels = currentPreset && currentPreset.models.length > 0;
  // Always show the API key field for the custom provider: an
  // OpenAI-compatible endpoint may or may not require a key.
  const showApiKey = currentPreset
    ? currentPreset.requiresApiKey || currentPreset.id === "custom"
    : true;
  const isCustomEndpoint =
    selectedProvider === "custom" || selectedProvider === "ollama";
  const isCustomProvider = selectedProvider === "custom";

  async function handleTestConnection(): Promise<void> {
    if (!baseURL || !selectedModel) return;

    setTestStatus("testing");
    setTestError("");

    try {
      const result = await window.api.invoke(Channels.AI_TEST_CONNECTION, {
        baseURL,
        apiKey,
        model: selectedModel,
        api,
      });

      if (result.success) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(result.error || "Connexion échouée");
      }
    } catch (e: unknown) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : String(e));
    }

    // Reset status after 5 seconds
    setTimeout(() => setTestStatus("idle"), 5000);
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration IA</CardTitle>
          <CardDescription>
            Configurez votre fournisseur d'IA, le point de terminaison et le
            modèle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fournisseur</label>
            <select
              className={selectClass}
              value={selectedProvider}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {providerPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* API protocol — only relevant for the custom provider */}
          {isCustomProvider && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Protocole API</label>
              <select
                className={selectClass}
                value={customApi}
                onChange={(e) => setCustomApi(e.target.value as ProviderApi)}
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="anthropic">
                  Anthropic-compatible (Messages API)
                </option>
              </select>
              <p className="text-xs text-muted-foreground">
                Choisissez « Anthropic-compatible » pour un point de
                terminaison Azure AI Foundry Claude / Messages API.
              </p>
            </div>
          )}

          {/* Endpoint URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Point de terminaison</label>
            <Input
              type="url"
              placeholder="https://api.example.com/v1"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              disabled={!isCustomEndpoint}
            />
            {!isCustomEndpoint && (
              <p className="text-xs text-muted-foreground">
                Prédéfini par le fournisseur. Choisissez « Custom » pour
                modifier.
              </p>
            )}
          </div>

          {/* API Key */}
          {showApiKey && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Clé API
                {currentPreset &&
                  !currentPreset.requiresApiKey &&
                  currentPreset.id === "custom" && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      (optionnel)
                    </span>
                  )}
              </label>
              <Input
                type="password"
                placeholder="Entrez votre clé API"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Modèle de langage</label>
            {hasPresetModels ? (
              <select
                className={selectClass}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {currentPreset.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                placeholder="Ex: llama3, mistral, mon-modele..."
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              />
            )}
            {!hasPresetModels && (
              <p className="text-xs text-muted-foreground">
                Saisissez le nom exact du modèle exposé par votre serveur.
              </p>
            )}
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === "testing" || !baseURL || !selectedModel}
            >
              {testStatus === "testing" && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Tester la connexion
            </Button>

            {testStatus === "success" && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Connexion réussie
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1 text-sm text-red-600 max-w-sm truncate">
                <XCircle className="w-4 h-4 shrink-0" />
                {testError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Dossier de données
            </div>
            <Button variant="outline" size="sm" onClick={onSelectFolder}>
              Changer
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-[10px] bg-muted p-2 rounded block break-all">
            {userDataPath}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
