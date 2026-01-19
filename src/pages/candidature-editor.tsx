import { Button } from "@/components/ui/button";
import { CandidatureConfig } from "@/lib/candidature-types";
import {
  FileJson,
  RefreshCw,
  CheckCircle2,
  Save,
  AlertCircle,
  User,
  Target,
  Building2,
  Briefcase,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

import { NavButton } from "@/components/resume-editor/shared";
import { CandidateSection } from "@/components/candidature-editor/CandidateSection";
import { GoalsSection } from "@/components/candidature-editor/GoalsSection";
import { TargetCompaniesSection } from "@/components/candidature-editor/TargetCompaniesSection";
import { ApplicationsSection } from "@/components/candidature-editor/ApplicationsSection";

const { ipcRenderer } = window.require("electron");

type SectionType = "candidate" | "goals" | "target_companies" | "applications";

export default function CandidatureEditorPage() {
  const [config, setConfig] = useState<CandidatureConfig>({
    candidate: {
      name: "",
      position: "",
      location: "",
      experience: "",
      languages: [],
      skills: [],
      strengths: [],
    },
    goals: {
      salary_target: "",
      contract_type: "",
      remote_policy: "",
      criteria: [],
    },
    target_companies: [],
    applications: [],
  });

  const [activeSection, setActiveSection] = useState<SectionType>("candidate");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const response = await ipcRenderer.invoke("read-file", {
        filePath: "candidature_config.json",
      });
      if (response.content) {
        try {
          const parsed = JSON.parse(response.content) as CandidatureConfig;
          setConfig(parsed);
        } catch (e) {
          setError("Fichier corrompu ou JSON invalide sur le disque.");
        }
      }
    } catch (err) {
      console.error("Failed to load config:", err);
      setError("Erreur lors du chargement de la configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const saveConfig = async () => {
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const res = await ipcRenderer.invoke("write-file", {
        filePath: "candidature_config.json",
        content: JSON.stringify(config, null, 2),
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      setError("Erreur lors de l'écriture du fichier.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCandidate = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      candidate: { ...prev.candidate, [field]: value },
    }));
  };

  const updateCandidateSkill = (index: number, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: prev.candidate.skills.map((s, i) =>
          i === index ? { ...s, [field]: value } : s,
        ),
      },
    }));
  };

  const addCandidateSkill = () => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: [...prev.candidate.skills, { category: "", technologies: "" }],
      },
    }));
  };

  const removeCandidateSkill = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: prev.candidate.skills.filter((_, i) => i !== index),
      },
    }));
  };

  const updateGoals = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      goals: { ...prev.goals, [field]: value },
    }));
  };

  // Generic array helpers
  const addItem = (
    section: "target_companies" | "applications",
    defaultValue: any,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: [...prev[section], defaultValue],
    }));
  };

  const removeItem = (
    section: "target_companies" | "applications",
    index: number,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  };

  const updateItem = (
    section: "target_companies" | "applications",
    index: number,
    field: string,
    value: any,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: (prev[section] as any[]).map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <FileJson className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Configuration Candidature</h1>
          {config?.candidate?.name && (
            <span className="text-muted-foreground ml-2">
              — {config.candidate.name}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadConfig}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")}
            />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={saveConfig}
            disabled={isSaving || isLoading}
            className={cn(saveSuccess && "bg-green-600 hover:bg-green-700")}
          >
            {saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saveSuccess ? "Enregistré" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r bg-muted/30 p-4 space-y-1 overflow-y-auto">
          <NavButton
            active={activeSection === "candidate"}
            onClick={() => setActiveSection("candidate")}
            icon={<User className="w-4 h-4" />}
            label="Profil Candidat"
          />
          <NavButton
            active={activeSection === "goals"}
            onClick={() => setActiveSection("goals")}
            icon={<Target className="w-4 h-4" />}
            label="Objectifs"
          />
          <NavButton
            active={activeSection === "target_companies"}
            onClick={() => setActiveSection("target_companies")}
            icon={<Building2 className="w-4 h-4" />}
            label="Cibles"
          />
          <NavButton
            active={activeSection === "applications"}
            onClick={() => setActiveSection("applications")}
            icon={<Briefcase className="w-4 h-4" />}
            label="Candidatures"
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-4 text-sm font-medium text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {activeSection === "candidate" && (
              <CandidateSection
                candidate={config.candidate}
                onUpdate={updateCandidate}
                onUpdateSkill={updateCandidateSkill}
                onAddSkill={addCandidateSkill}
                onRemoveSkill={removeCandidateSkill}
                onUpdateStrengths={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    candidate: { ...prev.candidate, strengths: v },
                  }))
                }
                onUpdateLanguages={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    candidate: { ...prev.candidate, languages: v },
                  }))
                }
              />
            )}

            {activeSection === "goals" && (
              <GoalsSection
                goals={config.goals}
                onUpdate={updateGoals}
                onUpdateCriteria={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    goals: { ...prev.goals, criteria: v },
                  }))
                }
              />
            )}

            {activeSection === "target_companies" && (
              <TargetCompaniesSection
                items={config.target_companies}
                onAdd={() =>
                  addItem("target_companies", {
                    name: "",
                    sector: "",
                    reason: "",
                    stack: "",
                  })
                }
                onRemove={(i) => removeItem("target_companies", i)}
                onUpdate={(i, f, v) => updateItem("target_companies", i, f, v)}
              />
            )}

            {activeSection === "applications" && (
              <ApplicationsSection
                items={config.applications}
                onAdd={() =>
                  addItem("applications", {
                    company: "",
                    position: "",
                    date: "",
                    status: "",
                    follow_up: "",
                    notes_path: "",
                  })
                }
                onRemove={(i) => removeItem("applications", i)}
                onUpdate={(i, f, v) => updateItem("applications", i, f, v)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
