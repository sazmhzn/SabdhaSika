import { cn } from "@/lib/cn";

/**
 * The button recipe, as a plain function in a module that carries no client
 * directive.
 *
 * ── Why this is its own file ────────────────────────────────────────
 *
 * It used to live in `Button.tsx`, which is a client component. That works
 * everywhere the recipe is consumed by another client component — and fails
 * outright the moment a *server* component calls it, because a function
 * exported from a client module is a client reference, not a function. The
 * build refuses it with "Attempted to call buttonClasses() from the server but
 * buttonClasses is on the client", which is exactly what happened when the
 * marketing pages tried to render a `<Link>` that looks like a button.
 *
 * The recipe is pure: it takes props and returns a string. Nothing about it
 * needs the client, so nothing about it belongs behind that boundary. Splitting
 * it out means a server component can style a link identically to a button —
 * which the landing page needs, since its calls to action must be real anchors
 * for crawlers, middle-click and "open in new tab".
 *
 * `Button.tsx` imports from here; it does not re-export, because re-exporting
 * through a client module would put the reference back behind the boundary.
 */

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

export const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-paper border border-transparent hover:opacity-90 shadow-[0_1px_2px_rgba(11,11,12,0.16)]",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink-soft border border-transparent hover:bg-surface",
  danger: "bg-bad-soft text-bad border border-transparent hover:brightness-[0.97]",
};

export const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-chip gap-2",
  md: "h-11 px-5 text-sm rounded-row gap-2",
  lg: "h-14 px-7 text-[15px] rounded-row gap-3",
};

/**
 * The class recipe, exported so a `<Link>` can look like a button without
 * either duplicating it or nesting a `<button>` inside an `<a>`.
 *
 * That nesting is not a style question: an anchor containing a button is
 * invalid HTML, it breaks middle-click and "open in new tab", and screen
 * readers announce it as two controls.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  full,
  className,
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "press chrome-noselect inline-flex select-none items-center justify-center font-semibold",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
    className,
  );
}

/* ------------------------------------------------------------------ *
 * The marketing button — Linear's recipe, not the app's.
 * ------------------------------------------------------------------ */

export type MarketingVariant = "primary" | "secondary" | "ghost";
export type MarketingSize = "sm" | "md" | "lg";

const MKT_VARIANTS: Record<MarketingVariant, string> = {
  /* The one chromatic action colour in the whole language. Acid lime on void,
     and nothing else on the site is allowed to look like this. */
  primary: "bg-acid text-void hover:brightness-110",
  secondary: "bg-carbon text-bone border border-graphite hover:bg-obsidian hover:border-smoke",
  ghost: "bg-transparent text-fog hover:text-bone",
};

/**
 * Linear's button geometry: 6px radius, tight horizontal padding, 510 weight.
 * Smaller and squarer than the app's, which is the point — a marketing button
 * is a precise instrument, not a large friendly target.
 */
const MKT_SIZES: Record<MarketingSize, string> = {
  sm: "h-8 px-3.5 text-[13px] rounded-mkt-sm gap-1.5",
  md: "h-9 px-4 text-[14px] rounded-mkt-sm gap-2",
  lg: "h-11 px-5 text-[15px] rounded-mkt-sm gap-2",
};

export function marketingButtonClasses({
  variant = "primary",
  size = "md",
  full,
  className,
}: {
  variant?: MarketingVariant;
  size?: MarketingSize;
  full?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "chrome-noselect inline-flex select-none items-center justify-center font-[510] tracking-[-0.01em]",
    "transition-[background-color,border-color,color,filter,transform] duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    MKT_VARIANTS[variant],
    MKT_SIZES[size],
    full && "w-full",
    className,
  );
}
