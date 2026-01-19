import { Input } from "@/components/ui/input";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface EducationSectionProps {
  items: Resume["education"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function EducationSection({ items, onAdd, onRemove, onUpdate }: EducationSectionProps) {
  return (
    <ArraySection
      title="Formation"
      description="Vos diplômes et études."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <Field label="Institution" value={item.institution} onChange={v => onUpdate(i, "institution", v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Domaine" value={item.area} onChange={v => onUpdate(i, "area", v)} placeholder="ex: Informatique" />
            <Field label="Type d'étude" value={item.studyType} onChange={v => onUpdate(i, "studyType", v)} placeholder="ex: Master" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de début" value={item.startDate} onChange={v => onUpdate(i, "startDate", v)} type="date" />
            <Field label="Date de fin" value={item.endDate} onChange={v => onUpdate(i, "endDate", v)} type="date" />
          </div>
          <Field label="Note / Score" value={item.score} onChange={v => onUpdate(i, "score", v)} placeholder="ex: 15/20, 3.8 GPA" />
          <div className="space-y-2">
            <label className="text-sm font-medium">Cours suivis (séparés par des virgules)</label>
            <Input 
              value={item.courses?.join(", ")} 
              onChange={e => onUpdate(i, "courses", e.target.value.split(",").map(c => c.trim()))}
              placeholder="Algorithmique, Base de données"
            />
          </div>
        </div>
      )}
    />
  );
}
