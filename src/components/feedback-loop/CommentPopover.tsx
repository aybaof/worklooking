import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getResumeSectionLabel } from "@/../shared/resume-sections";
import { X } from "lucide-react";

interface CommentPopoverProps {
  sectionId: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
}

/**
 * French comment editor for the active section. Disabled while regenerating.
 * Pure render.
 */
export function CommentPopover({
  sectionId,
  value,
  disabled,
  onChange,
  onClose,
}: CommentPopoverProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">
          Commentaire — {getResumeSectionLabel(sectionId)}
        </h4>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <Textarea
        value={value}
        disabled={disabled}
        placeholder="Décrivez ce que vous souhaitez modifier dans cette section..."
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
