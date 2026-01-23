import { ArraySection, Field } from "./shared";
import { Resume } from "@/../shared/resume-types";

interface LanguagesSectionProps {
  items: Resume["languages"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | string[] | undefined) => void;
}

export function LanguagesSection({ items, onAdd, onRemove, onUpdate }: LanguagesSectionProps) {
  return (
    <ArraySection
      title="Langues"
      description="Langues parlées et niveau."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Langue" value={item.language} onChange={v => onUpdate(i, "language", v)} />
          <Field label="Maîtrise" value={item.fluency} onChange={v => onUpdate(i, "fluency", v)} placeholder="ex: Maternel, Courant" />
        </div>
      )}
    />
  );
}
