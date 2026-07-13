import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Wrench } from "lucide-react";

interface RegenControlsProps {
  isRegenerating: boolean;
  hasComments: boolean;
  round: number;
  error: string | null;
  activeTool: { name: string; status: string } | null;
  onRegenerate: () => void;
  onValidate: () => void;
}

/**
 * Régénérer / Valider actions plus progress indicator and a French error
 * banner with retry. Pure render.
 */
export function RegenControls({
  isRegenerating,
  hasComments,
  round,
  error,
  activeTool,
  onRegenerate,
  onValidate,
}: RegenControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      {round > 0 && (
        <p className="text-xs text-muted-foreground">
          Tour de retours n° {round}
        </p>
      )}

      {isRegenerating && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 px-3 py-2 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            Régénération en cours...
          </div>
          {activeTool && (
            <div className="flex items-center gap-2 text-primary text-xs bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 animate-pulse">
              <Wrench className="w-3 h-3" />
              <span>
                Utilisation de l'outil : <strong>{activeTool.name}</strong>...
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Une erreur est survenue</p>
            <p className="text-xs">{error}</p>
            <p className="text-xs mt-1">
              Vos commentaires ont été conservés. Vous pouvez réessayer.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={onRegenerate}
          disabled={!hasComments || isRegenerating}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Régénérer
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onValidate}
          disabled={isRegenerating}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Valider
        </Button>
      </div>
    </div>
  );
}
