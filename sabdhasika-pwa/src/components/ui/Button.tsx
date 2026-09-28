"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses, type Size, type Variant } from "@/components/ui/button-classes";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

/**
 * The class recipe lives in `button-classes.ts`, not here.
 *
 * This file is a client component, and a function exported from a client module
 * is a client *reference* — a server component that calls it fails the build.
 * The landing page needs to style a `<Link>` as a button from the server, so
 * the recipe has to sit outside this boundary. See that file for the detail.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", full, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, full, className })}
      {...props}
    />
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "plain" | "surface";
}

const ICON_SIZES = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, size = "md", tone = "surface", type = "button", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "press chrome-noselect inline-grid shrink-0 place-items-center rounded-full",
        "disabled:pointer-events-none disabled:opacity-40",
        ICON_SIZES[size],
        tone === "surface"
          ? "border border-line bg-surface text-ink-soft hover:text-ink hover:bg-surface-2"
          : "border border-transparent text-muted hover:text-ink hover:bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
