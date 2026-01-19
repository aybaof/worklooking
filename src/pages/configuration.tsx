import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderOpen } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

interface IConfigurationPage {
  apiKey: string;
  setApiKey: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  userDataPath: string;
  onSelectFolder: () => void;
}

interface Model {
  id: string;
  name: string;
}

const MODELS: Model[] = [
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
];

export default function ConfigurationPage({
  apiKey,
  selectedModel,
  setApiKey,
  setSelectedModel,
  userDataPath,
  onSelectFolder,
}: IConfigurationPage) {
  const saveSettings = () => {
    localStorage.setItem("opencode_api_key", apiKey);
    localStorage.setItem("opencode_model", selectedModel);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration IA</CardTitle>
          <CardDescription>
            Configurez votre accès à l'intelligence artificielle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Clé API OpenCode</label>
            <Input
              type="password"
              placeholder="Entrez votre clé API"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Modèle de langage</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <Button className="w-full" onClick={saveSettings}>
            Sauvegarder les modifications
          </Button>
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
