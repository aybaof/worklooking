import { Input } from "@/components/ui/input";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface InterestsSectionProps {
  items: Resume["interests"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function InterestsSection({ items, onAdd, onRemove, onUpdate }: InterestsSectionProps) {
  return (
    <ArraySection
      title="Intérêts"
      description="Vos passions et hobbies."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <Field label="Nom de l'intérêt" value={item.name} onChange={v => onUpdate(i, "name", v)} placeholder="ex: Sport" />
          <div className="space-y-2">
            <label className="text-sm font-medium">Mots-clés (séparés par des virgules)</label>
            <Input 
              value={item.keywords?.join(", ")} 
              onChange={e => onUpdate(i, "keywords", e.target.value.split(",").map(k => k.trim()))}
              placeholder="Boxe, Course à pied"
            />
          </div>
        </div>
      )}
    />
  );
}
