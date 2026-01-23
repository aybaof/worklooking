import { ArraySection, Field } from "../resume-editor/shared";
import { CandidatureConfig } from "@/../shared/candidature-types";

interface ApplicationsSectionProps {
  items: CandidatureConfig["applications"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | string[] | undefined) => void;
}

export function ApplicationsSection({ items, onAdd, onRemove, onUpdate }: ApplicationsSectionProps) {
  return (
    <ArraySection
      title="Candidatures"
      description="Suivi de vos candidatures envoyées ou prévues."
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entreprise" value={item.company} onChange={v => onUpdate(i, "company", v)} />
            <Field label="Poste" value={item.position} onChange={v => onUpdate(i, "position", v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Date" value={item.date} onChange={v => onUpdate(i, "date", v)} />
            <Field label="Statut" value={item.status} onChange={v => onUpdate(i, "status", v)} />
            <Field label="Suivi" value={item.follow_up} onChange={v => onUpdate(i, "follow_up", v)} />
          </div>
          <Field label="Chemin des notes" value={item.notes_path} onChange={v => onUpdate(i, "notes_path", v)} />
        </div>
      )}
    />
  );
}
