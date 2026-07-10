import type { ReactElement } from "react";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/hooks/useTheme";

interface IThemeToggle {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

interface IThemeOption {
  value: ThemeMode;
  label: string;
  Icon: LucideIcon;
}

const options: IThemeOption[] = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Système", Icon: Monitor },
];

export function ThemeToggle({
  mode,
  onModeChange,
}: IThemeToggle): ReactElement {
  return (
    <div className="inline-flex gap-2">
      {options.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? "default" : "ghost"}
          aria-pressed={mode === value}
          onClick={() => onModeChange(value)}
        >
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}
