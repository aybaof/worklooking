import { CheckCircle2, Loader2, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveStatusProps {
  isSaving: boolean;
  isDirty: boolean;
  saveSuccess: boolean;
  error?: string | null;
  className?: string;
}

export function SaveStatus({ isSaving, isDirty, saveSuccess, error, className }: SaveStatusProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium transition-all duration-300", className)}>
      {isSaving ? (
        <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Enregistrement...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-1.5 text-destructive">
          <CloudOff className="w-3.5 h-3.5" />
          <span>Erreur d'enregistrement</span>
        </div>
      ) : saveSuccess ? (
        <div className="flex items-center gap-1.5 text-green-600 animate-in fade-in slide-in-from-bottom-1 duration-500">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Enregistré</span>
        </div>
      ) : isDirty ? (
        <div className="flex items-center gap-1.5 text-orange-500">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span>Modifications non enregistrées</span>
        </div>
      ) : null}
    </div>
  );
}
