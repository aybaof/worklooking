import { Button } from "@/components/ui/button";
import { Resume } from "@/lib/resume-types";
import {
  FileJson,
  RefreshCw,
  CheckCircle2,
  Save,
  AlertCircle,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Globe,
  FolderKanban,
  Trophy,
  BookOpen,
  Heart,
  Quote,
  HandHelping,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

import { NavButton } from "@/components/resume-editor/shared";
import { BasicsSection } from "@/components/resume-editor/BasicsSection";
import { WorkSection } from "@/components/resume-editor/WorkSection";
import { VolunteerSection } from "@/components/resume-editor/VolunteerSection";
import { EducationSection } from "@/components/resume-editor/EducationSection";
import { ProjectsSection } from "@/components/resume-editor/ProjectsSection";
import { SkillsSection } from "@/components/resume-editor/SkillsSection";
import { AwardsSection } from "@/components/resume-editor/AwardsSection";
import { PublicationsSection } from "@/components/resume-editor/PublicationsSection";
import { LanguagesSection } from "@/components/resume-editor/LanguagesSection";
import { InterestsSection } from "@/components/resume-editor/InterestsSection";
import { ReferencesSection } from "@/components/resume-editor/ReferencesSection";

type SectionType =
  | "basics"
  | "work"
  | "volunteer"
  | "education"
  | "projects"
  | "skills"
  | "awards"
  | "publications"
  | "languages"
  | "interests"
  | "references";

export default function ResumeEditorPage() {
  const [resume, setResume] = useState<Resume>({
    basics: {
      name: "",
      label: "",
      email: "",
      phone: "",
      url: "",
      summary: "",
      location: { city: "", countryCode: "", region: "" },
      profiles: [],
    },
    work: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
  });

  const [activeSection, setActiveSection] = useState<SectionType>("basics");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResume, setIsLoadingResume] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResume = async () => {
    setIsLoadingResume(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const savedResume = localStorage.getItem("worklooking_resume");
      if (savedResume) {
        try {
          const parsed = JSON.parse(savedResume) as Resume;
          setResume(parsed);
        } catch (e) {
          setError("Données de CV corrompues dans le stockage local.");
        }
      }
    } catch (err) {
      console.error("Failed to load resume:", err);
      setError("Erreur lors du chargement du CV.");
    } finally {
      setIsLoadingResume(false);
    }
  };

  useEffect(() => {
    loadResume();
  }, []);

  const saveResume = async () => {
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      localStorage.setItem(
        "worklooking_resume",
        JSON.stringify(resume, null, 2),
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save resume:", err);
      setError("Erreur lors de l'enregistrement du CV.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateBasics = (field: string, value: any) => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        [field]: value,
      },
    }));
  };

  const updateLocation = (field: string, value: any) => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        location: {
          ...prev.basics?.location,
          [field]: value,
        },
      },
    }));
  };

  const updateProfile = (index: number, field: string, value: any) => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        profiles: prev.basics?.profiles?.map((p, i) =>
          i === index ? { ...p, [field]: value } : p,
        ),
      },
    }));
  };

  const removeProfile = (index: number) => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        profiles: prev.basics?.profiles?.filter((_, i) => i !== index),
      },
    }));
  };

  // Generic array helpers
  const addItem = (
    section: keyof Resume | "basics_profiles",
    defaultValue: any,
  ) => {
    if (section === "basics_profiles") {
      setResume((prev) => ({
        ...prev,
        basics: {
          ...prev.basics,
          profiles: [...(prev.basics?.profiles || []), defaultValue],
        },
      }));
      return;
    }
    setResume((prev) => ({
      ...prev,
      [section]: [...((prev[section] as any[]) || []), defaultValue],
    }));
  };

  const removeItem = (section: keyof Resume, index: number) => {
    setResume((prev) => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((_, i) => i !== index),
    }));
  };

  const updateItem = (
    section: keyof Resume,
    index: number,
    field: string,
    value: any,
  ) => {
    setResume((prev) => ({
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
          <h1 className="text-xl font-bold">Éditeur de CV</h1>
          {resume?.basics?.name && (
            <span className="text-muted-foreground ml-2">
              — {resume.basics.name}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadResume}
            disabled={isLoadingResume}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", isLoadingResume && "animate-spin")}
            />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={saveResume}
            disabled={isSaving || isLoadingResume}
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
            active={activeSection === "basics"}
            onClick={() => setActiveSection("basics")}
            icon={<User className="w-4 h-4" />}
            label="Infos de base"
          />
          <NavButton
            active={activeSection === "work"}
            onClick={() => setActiveSection("work")}
            icon={<Briefcase className="w-4 h-4" />}
            label="Expériences"
          />
          <NavButton
            active={activeSection === "volunteer"}
            onClick={() => setActiveSection("volunteer")}
            icon={<HandHelping className="w-4 h-4" />}
            label="Bénévolat"
          />
          <NavButton
            active={activeSection === "education"}
            onClick={() => setActiveSection("education")}
            icon={<GraduationCap className="w-4 h-4" />}
            label="Formation"
          />
          <NavButton
            active={activeSection === "projects"}
            onClick={() => setActiveSection("projects")}
            icon={<FolderKanban className="w-4 h-4" />}
            label="Projets"
          />
          <NavButton
            active={activeSection === "skills"}
            onClick={() => setActiveSection("skills")}
            icon={<Wrench className="w-4 h-4" />}
            label="Compétences"
          />
          <NavButton
            active={activeSection === "awards"}
            onClick={() => setActiveSection("awards")}
            icon={<Trophy className="w-4 h-4" />}
            label="Prix / Awards"
          />
          <NavButton
            active={activeSection === "publications"}
            onClick={() => setActiveSection("publications")}
            icon={<BookOpen className="w-4 h-4" />}
            label="Publications"
          />
          <NavButton
            active={activeSection === "languages"}
            onClick={() => setActiveSection("languages")}
            icon={<Globe className="w-4 h-4" />}
            label="Langues"
          />
          <NavButton
            active={activeSection === "interests"}
            onClick={() => setActiveSection("interests")}
            icon={<Heart className="w-4 h-4" />}
            label="Intérêts"
          />
          <NavButton
            active={activeSection === "references"}
            onClick={() => setActiveSection("references")}
            icon={<Quote className="w-4 h-4" />}
            label="Références"
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

            {activeSection === "basics" && (
              <BasicsSection
                basics={resume.basics}
                onUpdate={updateBasics}
                onUpdateLocation={updateLocation}
                onUpdateProfile={updateProfile}
                onAddProfile={() =>
                  addItem("basics_profiles", {
                    network: "",
                    username: "",
                    url: "",
                  })
                }
                onRemoveProfile={removeProfile}
              />
            )}

            {activeSection === "work" && (
              <WorkSection
                items={resume.work}
                onAdd={() =>
                  addItem("work", {
                    name: "",
                    position: "",
                    startDate: "",
                    highlights: [],
                  })
                }
                onRemove={(i) => removeItem("work", i)}
                onUpdate={(i, f, v) => updateItem("work", i, f, v)}
              />
            )}

            {activeSection === "volunteer" && (
              <VolunteerSection
                items={resume.volunteer}
                onAdd={() =>
                  addItem("volunteer", {
                    organization: "",
                    position: "",
                    startDate: "",
                  })
                }
                onRemove={(i) => removeItem("volunteer", i)}
                onUpdate={(i, f, v) => updateItem("volunteer", i, f, v)}
              />
            )}

            {activeSection === "education" && (
              <EducationSection
                items={resume.education}
                onAdd={() =>
                  addItem("education", {
                    institution: "",
                    area: "",
                    studyType: "",
                    startDate: "",
                  })
                }
                onRemove={(i) => removeItem("education", i)}
                onUpdate={(i, f, v) => updateItem("education", i, f, v)}
              />
            )}

            {activeSection === "projects" && (
              <ProjectsSection
                items={resume.projects}
                onAdd={() =>
                  addItem("projects", {
                    name: "",
                    description: "",
                    keywords: [],
                  })
                }
                onRemove={(i) => removeItem("projects", i)}
                onUpdate={(i, f, v) => updateItem("projects", i, f, v)}
              />
            )}

            {activeSection === "skills" && (
              <SkillsSection
                items={resume.skills}
                onAdd={() =>
                  addItem("skills", { name: "", level: "", keywords: [] })
                }
                onRemove={(i) => removeItem("skills", i)}
                onUpdate={(i, f, v) => updateItem("skills", i, f, v)}
              />
            )}

            {activeSection === "awards" && (
              <AwardsSection
                items={resume.awards}
                onAdd={() =>
                  addItem("awards", { title: "", date: "", awarder: "" })
                }
                onRemove={(i) => removeItem("awards", i)}
                onUpdate={(i, f, v) => updateItem("awards", i, f, v)}
              />
            )}

            {activeSection === "publications" && (
              <PublicationsSection
                items={resume.publications}
                onAdd={() =>
                  addItem("publications", {
                    name: "",
                    publisher: "",
                    releaseDate: "",
                  })
                }
                onRemove={(i) => removeItem("publications", i)}
                onUpdate={(i, f, v) => updateItem("publications", i, f, v)}
              />
            )}

            {activeSection === "languages" && (
              <LanguagesSection
                items={resume.languages}
                onAdd={() =>
                  addItem("languages", { language: "", fluency: "" })
                }
                onRemove={(i) => removeItem("languages", i)}
                onUpdate={(i, f, v) => updateItem("languages", i, f, v)}
              />
            )}

            {activeSection === "interests" && (
              <InterestsSection
                items={resume.interests}
                onAdd={() => addItem("interests", { name: "", keywords: [] })}
                onRemove={(i) => removeItem("interests", i)}
                onUpdate={(i, f, v) => updateItem("interests", i, f, v)}
              />
            )}

            {activeSection === "references" && (
              <ReferencesSection
                items={resume.references}
                onAdd={() => addItem("references", { name: "", reference: "" })}
                onRemove={(i) => removeItem("references", i)}
                onUpdate={(i, f, v) => updateItem("references", i, f, v)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
