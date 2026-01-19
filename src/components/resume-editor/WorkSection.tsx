import { Textarea } from "@/components/ui/textarea";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface WorkSectionProps {
  items: Resume["work"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function WorkSection({ items, onAdd, onRemove, onUpdate }: WorkSectionProps) {
  return (
    <ArraySection
      title="Expériences professionnelles"
      description="Vos emplois et missions passés."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entreprise" value={item.name} onChange={v => onUpdate(i, "name", v)} />
            <Field label="Poste" value={item.position} onChange={v => onUpdate(i, "position", v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de début" value={item.startDate} onChange={v => onUpdate(i, "startDate", v)} type="date" />
            <Field label="Date de fin" value={item.endDate} onChange={v => onUpdate(i, "endDate", v)} type="date" placeholder="Laissez vide si en cours" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Résumé de la mission</label>
            <Textarea value={item.summary} onChange={e => onUpdate(i, "summary", e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Points forts (un par ligne)</label>
            <Textarea 
              value={item.highlights?.join("\n")} 
              onChange={e => onUpdate(i, "highlights", e.target.value.split("\n"))}
              rows={3}
              placeholder="Réalisation 1&#10;Réalisation 2"
            />
          </div>
        </div>
      )}
    />
  );
}
