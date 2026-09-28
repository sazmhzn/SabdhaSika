"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/hooks";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Hide the built-in close button when the sheet owns its own actions. */
  hideClose?: boolean;
  className?: string;
}

/** Drag past this distance — or flick faster than this — and the sheet dismisses. */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 620;

/**
 * A bottom sheet on mobile, a dialog on desktop. One component, two honest
 * layouts — not a mobile layout stretched across a monitor.
 *
 * **The entrance is the point.** The panel travels its own full height from
 * below the viewport edge (`y: "100%"`), so it genuinely rises out of the
 * bottom of the screen instead of fading in somewhere near it. A 28px nudge
 * reads as a pop-in; a full-height travel reads as a sheet. It is
 * deliberately overdamped — `damping` sits above critical damping for this
 * stiffness, so the panel cannot overshoot past the top edge, which is the
 * one artefact that makes a sliding sheet look broken.
 *
 * Desktop gets a fade-and-scale in place instead: a panel anchored to the
 * bottom of a monitor looks like a misplaced modal.
 *
 * Reduced motion collapses both to a plain cross-fade — the sheet still
 * arrives, it just does not travel.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  hideClose,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 640px)");

  /* Drag-to-dismiss is a mobile affordance only: on desktop the handle is
     hidden, and a draggable dialog fights text selection. */
  const draggable = !isDesktop && !reduce;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the sheet so keyboard users are not stranded behind it.
    const t = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      clearTimeout(t);
    };
  }, [open, onClose]);

  const panel = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDesktop
      ? {
          initial: { y: 16, opacity: 0, scale: 0.97 },
          animate: { y: 0, opacity: 1, scale: 1 },
          exit: { y: 12, opacity: 0, scale: 0.98 },
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
        };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.14 : 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={panel.initial}
            animate={panel.animate}
            exit={panel.exit}
            transition={
              reduce
                ? { duration: 0.16, ease: "easeOut" }
                : isDesktop
                  ? { type: "spring", stiffness: 420, damping: 36, mass: 0.7 }
                  : /* critical damping for k=400/m=0.9 is ≈37.9 — staying above
                       it is what stops the panel overshooting the top edge */
                    { type: "spring", stiffness: 400, damping: 42, mass: 0.9 }
            }
            drag={draggable ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) {
                onClose();
              }
            }}
            className={cn(
              "relative z-10 w-full max-w-lg rounded-t-card border border-line bg-paper pb-safe shadow-lift",
              "sm:rounded-card sm:pb-0",
              className,
            )}
          >
            {/* The grabber. Its 4px bar is the visual, but the absolutely
                positioned span below enlarges the touch target to ~68×28
                without occupying any layout — so the spacing rhythm is
                unchanged from when this was a purely decorative element. */}
            <div
              onPointerDown={(e) => draggable && dragControls.start(e)}
              className={cn(
                "relative mx-auto mt-3 h-1 w-9 rounded-full bg-line-strong sm:hidden",
                draggable && "cursor-grab active:cursor-grabbing",
              )}
            >
              <span className="absolute -inset-x-4 -inset-y-3" aria-hidden="true" />
            </div>
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 pad-sheet pt-6">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="press -mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                  >
                    <X className="size-4.5" strokeWidth={2.2} />
                  </button>
                )}
              </div>
            )}
            <div className="pad-sheet pb-6 pt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
