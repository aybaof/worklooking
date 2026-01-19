import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field } from "../resume-editor/shared";
import { CandidatureConfig } from "@/lib/candidature-types";
import { Textarea } from "@/components/ui/textarea";

interface GoalsSectionProps {
  goals: CandidatureConfig["goals"];
  onUpdate: (field: string, value: any) => void;
  onUpdateCriteria: (value: string[]) => void;
}

export function GoalsSection({ goals, onUpdate, onUpdateCriteria }: GoalsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Objectifs</CardTitle>
        <CardDescription>Vos attentes et critères de recherche.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cible salariale" value={goals.salary_target} onChange={v => onUpdate("salary_target", v)} />
          <Field label="Type de contrat" value={goals.contract_type} onChange={v => onUpdate("contract_type", v)} />
        </div>
        <Field label="Politique de télétravail" value={goals.remote_policy} onChange={v => onUpdate("remote_policy", v)} />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Critères (un par ligne)</label>
          <Textarea 
            value={goals.criteria.join("\n")} 
            onChange={e => onUpdateCriteria(e.target.value.split("\n").filter(s => s.trim()))} 
            rows={4} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
