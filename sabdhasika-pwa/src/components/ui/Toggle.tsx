"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "press chrome-noselect flex w-full items-center justify-between gap-4 rounded-row px-4 py-4 text-left",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {description && (
          <span className="mt-1 block text-[12px] leading-snug text-muted">{description}</span>
        )}
      </span>
      <span
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-ink" : "bg-surface-2 border border-line",
        )}
      >
        <motion.span
          className={cn(
            "absolute size-5 rounded-full shadow-[0_1px_3px_rgba(11,11,12,0.25)]",
            checked ? "bg-paper" : "bg-paper",
          )}
          animate={{ x: checked ? 26 : 4 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
        />
      </span>
    </button>
  );
}
