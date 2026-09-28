import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid min-w-6 place-items-center rounded-chip border border-line bg-surface px-2 py-1",
        "font-sans text-[10px] font-semibold text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export interface ShortcutHintProps {
  keys: string[];
  label: string;
  className?: string;
}

export function ShortcutHint({ keys, label, className }: ShortcutHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] text-faint", className)}>
      <span className="flex gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      {label}
    </span>
  );
}
