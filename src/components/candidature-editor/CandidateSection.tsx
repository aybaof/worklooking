import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Field } from "../resume-editor/shared";
import { CandidatureConfig } from "@/lib/candidature-types";
import { Textarea } from "@/components/ui/textarea";

interface CandidateSectionProps {
  candidate: CandidatureConfig["candidate"];
  onUpdate: (field: string, value: any) => void;
  onUpdateSkill: (index: number, field: string, value: any) => void;
  onAddSkill: () => void;
  onRemoveSkill: (index: number) => void;
  onUpdateStrengths: (value: string[]) => void;
  onUpdateLanguages: (value: string[]) => void;
}

export function CandidateSection({ 
  candidate, 
  onUpdate, 
  onUpdateSkill, 
  onAddSkill, 
  onRemoveSkill,
  onUpdateStrengths,
  onUpdateLanguages
}: CandidateSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidat</CardTitle>
        <CardDescription>Vos informations de profil pour les candidatures.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" value={candidate.name} onChange={v => onUpdate("name", v)} />
          <Field label="Poste recherché" value={candidate.position} onChange={v => onUpdate("position", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Localisation" value={candidate.location} onChange={v => onUpdate("location", v)} />
          <Field label="Expérience" value={candidate.experience} onChange={v => onUpdate("experience", v)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Langues (séparées par des virgules)</label>
          <Textarea 
            value={candidate.languages.join(", ")} 
            onChange={e => onUpdateLanguages(e.target.value.split(",").map(s => s.trim()))} 
            rows={2} 
          />
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Compétences</h3>
            <Button size="sm" variant="ghost" onClick={onAddSkill}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {candidate.skills.map((skill, i) => (
              <div key={i} className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg relative group">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <Field label="Catégorie" value={skill.category} onChange={v => onUpdateSkill(i, "category", v)} />
                  <Field label="Technologies" value={skill.technologies} onChange={v => onUpdateSkill(i, "technologies", v)} />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive h-9" 
                  onClick={() => onRemoveSkill(i)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t space-y-2">
          <label className="text-sm font-medium">Points forts (un par ligne)</label>
          <Textarea 
            value={candidate.strengths.join("\n")} 
            onChange={e => onUpdateStrengths(e.target.value.split("\n").filter(s => s.trim()))} 
            rows={4} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
