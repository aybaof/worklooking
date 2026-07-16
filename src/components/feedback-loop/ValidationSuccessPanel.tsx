import { CheckCircle2, AlertTriangle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationResult } from "@/hooks/useFeedbackLoop";

interface ValidationSuccessPanelProps {
  validationResult: ValidationResult;
  onRevealInFolder: () => void;
}

/**
 * French success panel shown after a successful deterministic Valider write
 * (`resume:generate-final`): the written path(s), an amber warning when the
 * PDF step failed (HTML-only partial success), and an "Afficher dans le
 * dossier" action. Pure render — all decision logic (which path to reveal,
 * when to show this panel) lives in `useFeedbackLoop`; this component only
 * wires the click. Consistent with the `RegenControls`/`RoundDiffPanel`
 * siblings.
 */
export function ValidationSuccessPanel({
  validationResult,
  onRevealInFolder,
}: ValidationSuccessPanelProps) {
  const { htmlPath, pdfPath, warning } = validationResult;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
      data-testid="validation-success-panel"
    >
      <div className="flex items-center gap-2 font-medium text-primary">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>CV généré avec succès</span>
      </div>

      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {pdfPath && (
          <p>
            <span className="font-medium text-foreground">PDF :</span>{" "}
            {pdfPath}
          </p>
        )}
        {htmlPath && (
          <p>
            <span className="font-medium text-foreground">HTML :</span>{" "}
            {htmlPath}
          </p>
        )}
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      <Button size="sm" variant="secondary" onClick={onRevealInFolder}>
        <FolderOpen className="h-4 w-4 mr-2" />
        Afficher dans le dossier
      </Button>
    </div>
  );
}
