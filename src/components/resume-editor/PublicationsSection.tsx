import { ArraySection, Field } from "./shared";
import { Resume } from "@/../shared/resume-types";

interface PublicationsSectionProps {
  items: Resume["publications"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | string[] | undefined) => void;
}

export function PublicationsSection({ items, onAdd, onRemove, onUpdate }: PublicationsSectionProps) {
  return (
    <ArraySection
      title="Publications"
      description="Vos articles, livres ou publications."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" value={item.name} onChange={v => onUpdate(i, "name", v)} />
            <Field label="Éditeur" value={item.publisher} onChange={v => onUpdate(i, "publisher", v)} />
          </div>
          <Field label="Date de publication" value={item.releaseDate} onChange={v => onUpdate(i, "releaseDate", v)} type="date" />
        </div>
      )}
    />
  );
}
