import { ArraySection, Field } from "../resume-editor/shared";
import { CandidatureConfig } from "@/lib/candidature-types";
import { Textarea } from "@/components/ui/textarea";

interface TargetCompaniesSectionProps {
  items: CandidatureConfig["target_companies"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function TargetCompaniesSection({ items, onAdd, onRemove, onUpdate }: TargetCompaniesSectionProps) {
  return (
    <ArraySection
      title="Entreprises Cibles"
      description="Entreprises que vous visez et pourquoi."
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom de l'entreprise" value={item.name} onChange={v => onUpdate(i, "name", v)} />
            <Field label="Secteur" value={item.sector} onChange={v => onUpdate(i, "sector", v)} />
          </div>
          <Field label="Stack technique" value={item.stack} onChange={v => onUpdate(i, "stack", v)} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Raison du ciblage</label>
            <Textarea 
              value={item.reason} 
              onChange={e => onUpdate(i, "reason", e.target.value)} 
              rows={2} 
            />
          </div>
        </div>
      )}
    />
  );
}
