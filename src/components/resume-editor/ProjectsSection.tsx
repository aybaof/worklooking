import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArraySection, Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface ProjectsSectionProps {
  items: Resume["projects"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

export function ProjectsSection({ items, onAdd, onRemove, onUpdate }: ProjectsSectionProps) {
  return (
    <ArraySection
      title="Projets"
      description="Projets personnels ou open source."
      items={items || []}
      onAdd={onAdd}
      onRemove={onRemove}
      renderItem={(item, i) => (
        <div className="space-y-4">
          <Field label="Nom du projet" value={item.name} onChange={v => onUpdate(i, "name", v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entité" value={item.entity} onChange={v => onUpdate(i, "entity", v)} placeholder="ex: Personnel, Open Source" />
            <Field label="Type" value={item.type} onChange={v => onUpdate(i, "type", v)} placeholder="ex: Application Web" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={item.description} onChange={e => onUpdate(i, "description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rôles" value={item.roles?.join(", ")} onChange={v => onUpdate(i, "roles", v.split(",").map(r => r.trim()))} placeholder="ex: Lead Developer" />
            <Field label="URL" value={item.url} onChange={v => onUpdate(i, "url", v)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mots-clés (séparés par des virgules)</label>
            <Input 
              value={item.keywords?.join(", ")} 
              onChange={e => onUpdate(i, "keywords", e.target.value.split(",").map(k => k.trim()))}
            />
          </div>
        </div>
      )}
    />
  );
}
