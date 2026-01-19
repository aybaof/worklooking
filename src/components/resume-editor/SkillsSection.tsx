import { Input } from "@/components/ui/input";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface SkillsSectionProps {
  items: Resume["skills"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function SkillsSection({ items, onAdd, onRemove, onUpdate }: SkillsSectionProps) {
  return (
    <ArraySection
      title="Compétences"
      description="Vos domaines d'expertise."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" value={item.name} onChange={v => onUpdate(i, "name", v)} placeholder="ex: Frontend" />
            <Field label="Niveau" value={item.level} onChange={v => onUpdate(i, "level", v)} placeholder="ex: Expert" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mots-clés (séparés par des virgules)</label>
            <Input 
              value={item.keywords?.join(", ")} 
              onChange={e => onUpdate(i, "keywords", e.target.value.split(",").map(k => k.trim()))}
              placeholder="React, Vue, TypeScript"
            />
          </div>
        </div>
      )}
    />
  );
}
