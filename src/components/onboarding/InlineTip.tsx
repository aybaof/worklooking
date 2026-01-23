import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Lightbulb } from "lucide-react";

interface InlineTipProps {
  tipId: string;
  title: string;
  content: string;
  onDismiss: (tipId: string) => void;
}

export function InlineTip({
  tipId,
  title,
  content,
  onDismiss,
}: InlineTipProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss(tipId);
  };

  if (!isVisible) return null;

  return (
    <div className="relative mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-blue-900 mb-1">{title}</h4>
          <p className="text-sm text-blue-800">{content}</p>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-blue-600 hover:text-blue-800"
            onClick={handleDismiss}
            aria-label="Dismiss tip"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
