import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnsavedCommentsConfirmProps {
  /** Whether the pending action is closing the modal or validating. */
  mode: "close" | "validate";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app French confirmation shown before discarding non-empty pending
 * comments (on close or on Valider). NOT `window.confirm` — this is a testable,
 * style-consistent renderer component. Pure render.
 */
export function UnsavedCommentsConfirm({
  mode,
  onConfirm,
  onCancel,
}: UnsavedCommentsConfirmProps) {
  const confirmLabel = mode === "validate" ? "Valider quand même" : "Fermer quand même";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Commentaires non enregistrés"
      data-testid="unsaved-comments-confirm"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-background p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">
              Commentaires non enregistrés
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Des commentaires non enregistrés seront perdus. Continuer ?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
