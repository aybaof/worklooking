import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface AwardsSectionProps {
  items: Resume["awards"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function AwardsSection({ items, onAdd, onRemove, onUpdate }: AwardsSectionProps) {
  return (
    <ArraySection
      title="Prix et distinctions"
      description="Vos récompenses et honneurs."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Titre" value={item.title} onChange={v => onUpdate(i, "title", v)} />
            <Field label="Date" value={item.date} onChange={v => onUpdate(i, "date", v)} type="date" />
          </div>
          <Field label="Décerné par" value={item.awarder} onChange={v => onUpdate(i, "awarder", v)} />
        </div>
      )}
    />
  );
}
