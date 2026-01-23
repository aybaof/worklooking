import { ArraySection, Field } from "./shared";
import { Resume } from "@/../shared/resume-types";

interface VolunteerSectionProps {
  items: Resume["volunteer"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | string[] | undefined) => void;
}

export function VolunteerSection({ items, onAdd, onRemove, onUpdate }: VolunteerSectionProps) {
  return (
    <ArraySection
      title="Bénévolat"
      description="Vos expériences de bénévolat."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Organisation" value={item.organization} onChange={v => onUpdate(i, "organization", v)} />
            <Field label="Poste" value={item.position} onChange={v => onUpdate(i, "position", v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de début" value={item.startDate} onChange={v => onUpdate(i, "startDate", v)} type="date" />
            <Field label="Date de fin" value={item.endDate} onChange={v => onUpdate(i, "endDate", v)} type="date" />
          </div>
        </div>
      )}
    />
  );
}
