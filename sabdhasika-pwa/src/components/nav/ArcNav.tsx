"use client";

import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ArcNavItem {
  href: string;
  label: string;
  /** Shown as the native tooltip, for a bar that is icons-only. */
  hint?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface ArcNavProps {
  items: readonly ArcNavItem[];
  /**
   * The active index. **This component is controlled** — it holds no index of
   * its own, so the caller can set it from a route, a store, a gesture, a
   * keyboard shortcut, or anything else. `-1` means "none of these", which
   * hides the indicator rather than parking it on the wrong item.
   */
  activeIndex: number;
  /** Called for every selection, from a tap, an arrow key or a swipe. */
  onSelect?: (index: number, item: ArcNavItem) => void;
  /** Optional label for the landmark, for pages with more than one nav. */
  label?: string;
  className?: string;
}

/* ------------------------------------------------------------------------- *
 * Geometry
 *
 * The bar is a shallow dome: its top edge is a parabola that rises `RISE`
 * above its two ends, and the items sit on a line parallel to that arc. So the
 * items are not in a row — the outer ones sit lower than the middle one — and
 * the indicator travels along the curve when the index changes.
 *
 * Everything is expressed in the SVG's own units, and the SVG is stretched to
 * the container with `preserveAspectRatio="none"`. The vertical scale is
 * therefore exactly 1 (the container is `VB_H` tall), which is what lets the
 * items be positioned in plain pixels and stay glued to the drawn arc.
 * ------------------------------------------------------------------------- */
const VB_W = 360;
const VB_H = 84;
/** How far the arc's apex rises above its ends. */
const RISE = 13;
/** Distance from the arc down to an item's centre. */
const ITEM_DROP = 40;
/**
 * The widest an item may be, and the breathing room kept between two of them.
 *
 * The width is *derived*, not fixed. The outermost item's centre sits
 * `width/(2·count)` from the bar's end, so a pill wider than `width/count`
 * overflows the silhouette — at 320px five 58px pills need 290px inside a
 * 273px bar, which pushed the last one's corner past the bar's rounded edge.
 * Deriving it also stops neighbours from overlapping, which would quietly
 * steal taps from the item next door.
 */
const PILL_MAX = 58;
const PILL_GAP = 4;
const PILL_H = 46;
const CORNER = 30;

/** The arc's height at normalised position `u` (0 = left end, 0.5 = apex). */
function arcY(u: number): number {
  return RISE * (2 * u - 1) ** 2;
}

/** Centre of item `i`, in viewBox units. */
function itemCentre(i: number, count: number): { u: number; y: number } {
  const u = (i + 0.5) / count;
  return { u, y: arcY(u) + ITEM_DROP };
}

const BAR_PATH = [
  `M 0 ${RISE}`,
  /* Quadratic with its control point mirrored above the apex: the curve passes
     through (VB_W/2, 0), so the dome is exactly RISE tall. */
  `Q ${VB_W / 2} ${-RISE} ${VB_W} ${RISE}`,
  `L ${VB_W} ${VB_H - CORNER}`,
  `A ${CORNER} ${CORNER} 0 0 1 ${VB_W - CORNER} ${VB_H}`,
  `L ${CORNER} ${VB_H}`,
  `A ${CORNER} ${CORNER} 0 0 1 0 ${VB_H - CORNER}`,
  "Z",
].join(" ");

/** Flick thresholds for the swipe path, mirroring the sheet's drag-to-dismiss. */
const SWIPE_DISTANCE = 44;
const SWIPE_VELOCITY = 420;

/**
 * The bottom navigation.
 *
 * **Why an arc.** A flat bar of five icons is the same shape in every app.
 * Curving it costs nothing functionally and buys a silhouette that is
 * recognisably this product — and it gives the indicator somewhere to travel,
 * so changing section reads as movement rather than a colour swap.
 *
 * **Why controlled.** `activeIndex` is a prop, never internal state. Tapping is
 * only one of the ways it changes: the route drives it (so deep links, the back
 * button and any `router.push` elsewhere in the app move it), arrow keys move
 * it while the bar has focus, and a horizontal swipe across the bar moves it.
 * Keeping the index outside means a future caller — a coach-mark, a shortcut, a
 * test — can set it directly without reaching into this component.
 */
export function ArcNav({
  items,
  activeIndex,
  onSelect,
  label = "Primary",
  className,
}: ArcNavProps) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  /* The indicator is positioned in pixels so it can be animated with a
     `transform`; `left: %` would be a layout change on every frame. */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const select = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      onSelect?.(index, items[index]);
    },
    [items, onSelect],
  );

  /* Arrow keys. Handled on the container so it works from any item's focus
     ring, and deliberately *not* wrapped at the ends — a nav that jumps from
     Settings back to Learn on a right-arrow is disorienting. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    select(activeIndex + (e.key === "ArrowRight" ? 1 : -1));
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) select(activeIndex + 1);
    else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) select(activeIndex - 1);
  };

  const hasActive = activeIndex >= 0 && activeIndex < items.length;
  const activeCentre = hasActive ? itemCentre(activeIndex, items.length) : null;

  /* Before the first measurement (`width === 0`, i.e. the server render) fall
     back to the maximum; `useLayoutEffect` measures before the browser paints,
     so the fallback is never actually shown. */
  const pillW = width > 0 ? Math.min(PILL_MAX, width / items.length - PILL_GAP) : PILL_MAX;

  return (
    <nav
      aria-label={label}
      data-arc-nav=""
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-safe lg:hidden",
        className,
      )}
    >
      <motion.div
        ref={containerRef}
        role="presentation"
        onKeyDown={onKeyDown}
        drag={reduce ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.07}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        style={{ height: VB_H }}
        className="arc-nav pointer-events-auto relative mb-3 w-full max-w-[420px] touch-pan-y"
      >
        {/* The bar's silhouette. The shadow has to be a `drop-shadow` filter:
            a box-shadow would paint a rectangle behind the arc. */}
        <div className="arc-nav-shadow absolute inset-0">
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <path
              d={BAR_PATH}
              strokeWidth={1}
              /* Keeps the hairline 1px however far the shape is stretched. */
              vectorEffect="non-scaling-stroke"
              style={{ fill: "var(--surface)", stroke: "var(--line)" }}
            />
          </svg>
        </div>

        {/* The indicator, riding the arc. */}
        {activeCentre && width > 0 && (
          <motion.span
            aria-hidden="true"
            data-arc-indicator=""
            initial={false}
            animate={{
              x: activeCentre.u * width - pillW / 2,
              y: activeCentre.y - PILL_H / 2,
            }}
            transition={
              reduce
                ? { duration: 0 }
                : /* Critical damping for k=420/m=0.8 is ≈36.7; 34 leaves a
                     couple of pixels of settle, which is what makes the travel
                     read as physical without overshooting past the item. */
                  { type: "spring", stiffness: 420, damping: 34, mass: 0.8 }
            }
            style={{ width: pillW, height: PILL_H }}
            className="pointer-events-none absolute left-0 top-0 rounded-[17px] bg-ink"
          />
        )}

        {items.map((item, i) => {
          const { u, y } = itemCentre(i, items.length);
          const active = i === activeIndex;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => select(i)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.hint}
              data-arc-item={i}
              data-arc-active={active ? "true" : undefined}
              /* Margins rather than a translate: `.press` owns `transform` for
                 the tactile feedback and would otherwise cancel the centring. */
              style={{
                left: `${u * 100}%`,
                top: y,
                width: pillW,
                height: PILL_H,
                marginLeft: -pillW / 2,
                marginTop: -PILL_H / 2,
              }}
              className={cn(
                "press chrome-noselect absolute grid place-items-center rounded-[17px]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                active ? "text-paper" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="size-[21px]" strokeWidth={active ? 2.4 : 2} />
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
}
