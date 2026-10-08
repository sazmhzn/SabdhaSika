"use client";

import { useEffect, useRef } from "react";
import { Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/lib/types";

/**
 * Interactive dropping stack for the marketing hero.
 *
 * The card face is the existing `FlashcardDemo` markup verbatim (rank chip,
 * word, romanization, meaning, example, corpus footnote) — only the wrapper
 * is the Osmo stack. Motion is Osmo's `initDroppingCardsStack` ported to a
 * single React instance: hooks named `data-dropping-stack-*` are preserved,
 * offsets derive from the collection padding, and drag, click halves, and
 * arrow-keys behave as the resource does (buttons removed).
 *
 * One extension: a drop has a direction. Buttons and vertical drags drop
 * down (Osmo-faithful); clicking the left/right half of the top card, or
 * flinging it horizontally past the threshold, drops it that way instead.
 * Drops are visual-only — the deck loops and nothing is recorded.
 *
 * Without JavaScript, with reduced motion, or with fewer than 3 words, this
 * renders a single static card (CSS hides the rest until `data-stack-live`
 * is set), so the hero still paints its argument in the first frame.
 */
const VISIBLE_COUNT = 4;
const DURATION = 0.75;
const DRAG_THRESHOLD_PERCENT = 20;
/** A native click right after a drag release belongs to the drag, not a tap. */
const CLICK_SUPPRESS_MS = 300;
/** A release that moved this little is a tap — the click decides direction. */
const CLICK_MAX_PX = 8;

type DropDirection = "down" | "left" | "right";

export function HeroStack({ words }: { words: VocabularyWord[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || words.length < 3) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.dataset.reduceMotion === "true") return;

    let disposed = false;
    let dispose = () => {};

    void (async () => {
      const [{ default: gsap }, { Draggable }, { CustomEase }] = await Promise.all([
        import("gsap"),
        import("gsap/Draggable"),
        import("gsap/CustomEase"),
      ]);
      if (disposed || !root.isConnected) return;

      gsap.registerPlugin(Draggable, CustomEase);
      CustomEase.create("osmo", "0.625, 0.05, 0, 1");

      const list = root.querySelector(".dropping-stack__list");
      if (!list) return;
      const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-dropping-stack-item]"));
      const total = cards.length;
      if (total < 3) return;

      let activeIndex = 0;
      let isAnimating = false;
      let settling = false;
      let suppressClickUntil = 0;
      let isActive = false;

      let dragEl: HTMLElement | null = null;
      let draggable: Draggable | null = null;
      let topClick: ((e: MouseEvent) => void) | null = null;

      let limitX = 1;
      let limitY = 1;
      let offsetX = "0px";
      let offsetY = "0px";

      const mod = (n: number, m: number) => ((n % m) + m) % m;
      const cardAt = (offset: number) => cards[mod(activeIndex + offset, total)]!;

      const getUnitValue = (val: string, depth: number) => {
        const num = parseFloat(val) || 0;
        const unit = val.replace(/[0-9.-]/g, "") || "px";
        return num * depth + unit;
      };

      function updateOffsetsFromPadding() {
        const collection = root!.querySelector("[data-dropping-stack-collection]");
        if (!collection) return;
        const styles = getComputedStyle(collection);
        const padRight = parseFloat(styles.paddingRight) || 0;
        const padLeft = parseFloat(styles.paddingLeft) || 0;
        const padBottom = parseFloat(styles.paddingBottom) || 0;
        const padTop = parseFloat(styles.paddingTop) || 0;
        const steps = Math.max(1, VISIBLE_COUNT - 1);
        const usePadX = Math.max(padRight, padLeft);
        const usePadY = Math.max(padBottom, padTop);
        const signX = padLeft > padRight ? -1 : 1;
        const signY = padTop > padBottom ? -1 : 1;
        offsetX = (usePadX / steps) * signX + "px";
        offsetY = (usePadY / steps) * signY + "px";
      }

      function updateDragLimits() {
        if (!dragEl) return;
        const rect = dragEl.getBoundingClientRect();
        limitX = rect.width || 1;
        limitY = rect.height || 1;
      }

      function applyState() {
        updateOffsetsFromPadding();
        for (const card of cards) {
          gsap.set(card, {
            opacity: 0,
            pointerEvents: "none",
            zIndex: 0,
            x: 0,
            y: 0,
            xPercent: 0,
            yPercent: 0,
          });
        }
        for (let depth = 0; depth < Math.min(VISIBLE_COUNT, total); depth++) {
          const card = cardAt(depth);
          const xVal = getUnitValue(offsetX, depth);
          const yVal = getUnitValue(offsetY, depth);
          const state: Record<string, string | number> = {
            opacity: 1,
            zIndex: 999 - depth,
            pointerEvents: depth === 0 ? "auto" : "none",
          };
          if (offsetX.includes("%")) state.xPercent = parseFloat(xVal);
          else state.x = xVal;
          if (offsetY.includes("%")) state.yPercent = parseFloat(yVal);
          else state.y = yVal;
          gsap.set(card, state);
        }

        dragEl = cardAt(0);
        gsap.set(dragEl, { touchAction: "none" });
        updateDragLimits();

        if (draggable) {
          draggable.kill();
          draggable = null;
        }
        if (dragEl && topClick) dragEl.removeEventListener("click", topClick);

        const magnetize = (raw: number, limit: number) => {
          const sign = Math.sign(raw) || 1;
          return sign * limit * Math.tanh(Math.abs(raw) / limit);
        };

        const el = dragEl;
        topClick = (e: MouseEvent) => {
          if (isAnimating || settling || Date.now() < suppressClickUntil || !el) return;
          const rect = el.getBoundingClientRect();
          animateNext(e.clientX < rect.left + rect.width / 2 ? "left" : "right", false);
        };
        el.addEventListener("click", topClick);

        draggable = Draggable.create(el, {
          type: "x,y",
          inertia: false,
          onPress: () => {
            if (isAnimating) return;
            gsap.killTweensOf(el);
            gsap.set(el, { zIndex: 2000, opacity: 1 });
          },
          onDrag: function () {
            if (isAnimating) return;
            gsap.set(el, {
              x: magnetize(this.x, limitX),
              y: magnetize(this.y, limitY),
              opacity: 1,
            });
          },
          onRelease: function () {
            if (isAnimating) return;
            const currentX = Number(gsap.getProperty(el, "x")) || 0;
            const currentY = Number(gsap.getProperty(el, "y")) || 0;
            const movedPercent =
              Math.max(Math.abs(currentX) / limitX, Math.abs(currentY) / limitY) * 100;
            if (movedPercent >= DRAG_THRESHOLD_PERCENT) {
              suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
              const direction: DropDirection =
                Math.abs(currentX) > Math.abs(currentY)
                  ? currentX < 0
                    ? "left"
                    : "right"
                  : "down";
              animateNext(direction, true, currentX, currentY);
              return;
            }
            // A tap barely moves the card — leave it centred and let the
            // native click that follows drop it left/right. Anything larger
            // snaps back and swallows its click.
            if (Math.hypot(currentX, currentY) <= CLICK_MAX_PX) {
              gsap.set(el, { x: 0, y: 0 });
              return;
            }
            suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
            settling = true;
            gsap.to(el, {
              x: 0,
              y: 0,
              opacity: 1,
              duration: 1,
              ease: "elastic.out(1, 0.7)",
              onComplete: () => {
                settling = false;
                if (!disposed) applyState();
              },
            });
          },
        })[0]!;
      }

      function animateNext(direction: DropDirection = "down", fromDrag = false, releaseX = 0, releaseY = 0) {
        if (isAnimating) return;
        isAnimating = true;

        const outgoing = cardAt(0);
        const incomingBack = cardAt(VISIBLE_COUNT);
        const tl = gsap.timeline({
          defaults: { duration: DURATION, ease: "osmo" },
          onComplete: () => {
            activeIndex = mod(activeIndex + 1, total);
            if (!disposed) applyState();
            isAnimating = false;
          },
        });

        gsap.set(outgoing, { zIndex: 2000, opacity: 1 });
        if (fromDrag) gsap.set(outgoing, { x: releaseX, y: releaseY });

        if (direction === "left") tl.to(outgoing, { xPercent: -200, yPercent: 0 }, 0);
        else if (direction === "right") tl.to(outgoing, { xPercent: 200, yPercent: 0 }, 0);
        else tl.to(outgoing, { xPercent: 0, yPercent: 200 }, 0);
        tl.to(outgoing, { opacity: 0, duration: DURATION * 0.2, ease: "none" }, DURATION * 0.4);

        for (let depth = 1; depth < VISIBLE_COUNT; depth++) {
          const xVal = getUnitValue(offsetX, depth - 1);
          const yVal = getUnitValue(offsetY, depth - 1);
          const move: Record<string, string | number> = { zIndex: 999 - (depth - 1) };
          if (offsetX.includes("%")) move.xPercent = parseFloat(xVal);
          else move.x = xVal;
          if (offsetY.includes("%")) move.yPercent = parseFloat(yVal);
          else move.y = yVal;
          tl.to(cardAt(depth), move, 0);
        }

        const backX = getUnitValue(offsetX, VISIBLE_COUNT);
        const backY = getUnitValue(offsetY, VISIBLE_COUNT);
        const startX = getUnitValue(offsetX, VISIBLE_COUNT - 1);
        const startY = getUnitValue(offsetY, VISIBLE_COUNT - 1);
        const incomingSet: Record<string, string | number> = {
          opacity: 0,
          zIndex: 999 - VISIBLE_COUNT,
        };
        if (offsetX.includes("%")) incomingSet.xPercent = parseFloat(backX);
        else incomingSet.x = backX;
        if (offsetY.includes("%")) incomingSet.yPercent = parseFloat(backY);
        else incomingSet.y = backY;
        gsap.set(incomingBack, incomingSet);

        const incomingTo: Record<string, string | number> = { opacity: 1 };
        if (offsetX.includes("%")) incomingTo.xPercent = parseFloat(startX);
        else incomingTo.x = startX;
        if (offsetY.includes("%")) incomingTo.yPercent = parseFloat(startY);
        else incomingTo.y = startY;
        tl.to(incomingBack, incomingTo, 0);
      }

      function animatePrev() {
        if (isAnimating) return;
        isAnimating = true;

        const incomingTop = cardAt(-1);
        const leavingBack = cardAt(VISIBLE_COUNT - 1);
        const tl = gsap.timeline({
          defaults: { duration: DURATION, ease: "osmo" },
          onComplete: () => {
            activeIndex = mod(activeIndex - 1, total);
            if (!disposed) applyState();
            isAnimating = false;
          },
        });

        gsap.set(leavingBack, { zIndex: 1 });
        gsap.set(incomingTop, { opacity: 0, x: 0, xPercent: 0, yPercent: -200, zIndex: 2000 });
        tl.to(incomingTop, { yPercent: 0 }, 0);
        tl.to(incomingTop, { opacity: 1, duration: DURATION * 0.2, ease: "none" }, DURATION * 0.3);

        for (let depth = 0; depth < VISIBLE_COUNT - 1; depth++) {
          const xVal = getUnitValue(offsetX, depth + 1);
          const yVal = getUnitValue(offsetY, depth + 1);
          const move: Record<string, string | number> = { zIndex: 999 - (depth + 1) };
          if (offsetX.includes("%")) move.xPercent = parseFloat(xVal);
          else move.x = xVal;
          if (offsetY.includes("%")) move.yPercent = parseFloat(yVal);
          else move.y = yVal;
          tl.to(cardAt(depth), move, 0);
        }

        const backX = getUnitValue(offsetX, VISIBLE_COUNT);
        const backY = getUnitValue(offsetY, VISIBLE_COUNT);
        const hideBack: Record<string, string | number> = { opacity: 0 };
        if (offsetX.includes("%")) hideBack.xPercent = parseFloat(backX);
        else hideBack.x = backX;
        if (offsetY.includes("%")) hideBack.yPercent = parseFloat(backY);
        else hideBack.y = backY;
        tl.to(leavingBack, hideBack, 0);
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            isActive = entry.isIntersecting && entry.intersectionRatio >= 0.6;
          }
        },
        { threshold: [0, 0.6, 1] },
      );
      observer.observe(root);

      const onKeyDown = (e: KeyboardEvent) => {
        if (!isActive || isAnimating) return;
        const tag = e.target instanceof HTMLElement ? e.target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select" || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          animateNext("down", false);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          animatePrev();
        }
      };
      const onResize = () => {
        if (!isAnimating) applyState();
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", onResize);

      root.setAttribute("data-stack-live", "true");
      applyState();

      dispose = () => {
        observer.disconnect();
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", onResize);
        if (dragEl && topClick) dragEl.removeEventListener("click", topClick);
        draggable?.kill();
        gsap.killTweensOf(cards);
        root.removeAttribute("data-stack-live");
      };
    })();

    return () => {
      disposed = true;
      dispose();
    };
  }, [words.length]);

  return (
    <div data-dropping-stack-init ref={rootRef} className="dropping-stack">
      <div data-dropping-stack-collection className="dropping-stack__collection">
        <div className="dropping-stack__list">
          {words.map((word) => (
            <div key={word.id} data-dropping-stack-item className="dropping-stack__item">
              <div className="rounded-mkt border border-graphite bg-carbon p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] lg:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-mkt-xs border border-graphite bg-obsidian px-2 py-0.5 text-[11px] font-[510] text-mist tabular-nums">
                      #{word.frequencyRank}
                    </span>
                    {word.partOfSpeech && (
                      <span className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                        {word.partOfSpeech}
                      </span>
                    )}
                  </div>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-graphite bg-obsidian text-fog"
                    aria-hidden="true"
                  >
                    <Volume2 className="size-3.5" strokeWidth={2} />
                  </span>
                </div>

                <p className="mt-7 text-[clamp(3rem,9vw,3.75rem)] font-[510] leading-none tracking-[-0.03em] text-white">
                  {word.word}
                </p>
                {word.romanized && <p className="mt-2.5 text-[18px] text-fog">{word.romanized}</p>}

                <div className="my-6 h-px w-full bg-graphite" />

                <p className="text-[16.5px] font-[510] text-bone">{word.meaning}</p>

                {word.example && (
                  <div className="mt-4">
                    <p className="text-[15px] leading-relaxed text-mist">{word.example.native}</p>
                    {word.example.romanized && (
                      <p className="mt-1 text-[13px] text-ash">{word.example.romanized}</p>
                    )}
                    <p className="mt-2 text-[13px] text-fog">{word.example.translation}</p>
                  </div>
                )}

                <p className="mt-6 text-[11px] leading-relaxed text-ash">
                  Rank {word.frequencyRank} of 3,000, from the shipped Japanese corpus list
                  {word.frequency ? ` — ${word.frequency.toLocaleString()} occurrences` : ""}.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
