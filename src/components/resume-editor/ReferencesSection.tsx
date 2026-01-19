import { Textarea } from "@/components/ui/textarea";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface ReferencesSectionProps {
  items: Resume["references"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function ReferencesSection({ items, onAdd, onRemove, onUpdate }: ReferencesSectionProps) {
  return (
    <ArraySection
      title="Références"
      description="Personnes pouvant témoigner de votre travail."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <Field label="Nom" value={item.name} onChange={v => onUpdate(i, "name", v)} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Référence / Témoignage</label>
            <Textarea value={item.reference} onChange={e => onUpdate(i, "reference", e.target.value)} rows={3} />
          </div>
        </div>
      )}
    />
  );
}
