import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text" }: { label: string, value?: string, onChange: (v: string) => void, placeholder?: string, type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function ArraySection<T>({ title, description, items, onAdd, onRemove, renderItem }: { 
  title: string, 
  description: string, 
  items: T[], 
  onAdd: () => void, 
  onRemove: (index: number) => void,
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" /> Ajouter
        </Button>
      </div>

      <div className="space-y-4">
        {items.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
            Aucun élément pour le moment.
          </div>
        )}
        {items.map((item, i) => (
          <Card key={i} className="relative group">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <CardContent className="pt-6">
              {renderItem(item, i)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
