import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { MarketingSize } from "@/components/ui/button-classes";

interface PrimaryCtaProps {
  label: string;
  icon?: ReactNode;
  size?: MarketingSize;
  full?: boolean;
  className?: string;
  href?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  busy?: boolean;
}

/**
 * The marketing primary button, carrying the Osmo 023 sweep.
 *
 * A server component — the effect is pure CSS, so anchors stay real anchors
 * for crawlers and middle-click. Renders a `Link` when `href` is given, a
 * `<button>` otherwise. The label (and icon, when present) is rendered twice
 * because the rollover animates the second copy in; the copy is `aria-hidden`
 * so screen readers announce one control.
 */
export function PrimaryCta({
  label,
  icon,
  size = "md",
  full,
  className,
  href,
  type = "button",
  disabled,
  busy,
}: PrimaryCtaProps) {
  const cls = cn(
    "button-023",
    `button-023--${size}`,
    full && "button-023--full",
    "chrome-noselect",
    className,
  );

  const inner = (
    <>
      <span className="button-023__bg" aria-hidden="true">
        <span style={{ "--index": 0 } as CSSProperties} className="button-023__bg-inner is--first" />
        <span style={{ "--index": 1 } as CSSProperties} className="button-023__bg-inner is--second" />
      </span>
      <span className="button-023__inner">
        <span className="button-023__text is--first">
          {label}
          {icon && (
            <span aria-hidden="true" className="inline-flex">
              {icon}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="button-023__text is--second">
          {label}
          {icon && <span className="inline-flex">{icon}</span>}
        </span>
      </span>
    </>
  );

  if (href !== undefined) {
    return (
      <Link href={href} data-button-023="" className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      data-button-023=""
      className={cls}
    >
      {inner}
    </button>
  );
}
