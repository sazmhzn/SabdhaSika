"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccountStore } from "@/lib/account-store";
import { marketingButtonClasses } from "@/components/ui/button-classes";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#ladder", label: "The ladder" },
  { href: "#languages", label: "Languages" },
  { href: "#questions", label: "Questions" },
];

/**
 * The marketing navigation.
 *
 * ── The two things it has to get right ──────────────────────────────
 *
 * First, the call to action depends on who is looking: a visitor gets "Get
 * started", a signed-in learner gets "Open the app" — sending someone who
 * already has an account to a sign-up page is the most common small insult on a
 * marketing site. Second, it has to stay legible over the page, so it gains a
 * hairline and a blur once it is no longer at the top rather than sitting on a
 * permanent bar.
 *
 * ── Why the bar is this thin ────────────────────────────────────────
 *
 * Linear's chrome is 56–64px, not 80. The nav is a way back to four anchors and
 * one button; every pixel it takes is a pixel of the page's own headline, which
 * is the thing the visitor actually came to read. It is also the reason the
 * links carry no backgrounds: at this weight a hover fill on four items reads
 * as four buttons competing with the one real button on the right.
 */
export function SiteNav() {
  const session = useAccountStore((s) => s.session);
  const hydrated = useAccountStore((s) => s.hydrated);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* A disclosure menu that stays open while the page scrolls behind it is a
     trap on a phone, so it closes on navigation and on Escape. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* `hydrated` matters: before the session is read, rendering the signed-out
     CTA would flash "Get started" at someone who is already signed in. */
  const signedIn = hydrated && Boolean(session);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-300",
        scrolled
          ? "border-b border-graphite bg-void/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Site"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-6 px-6 lg:px-10"
      >
        <Link
          href="/"
          className="chrome-noselect flex shrink-0 items-center gap-2.5 rounded-mkt-sm"
          aria-label="SabdhaSika home"
        >
          <GlyphTile glyph="श" reading="śa" size={30} />
          <span className="text-[15px] font-[590] tracking-[-0.02em] text-white">SabdhaSika</span>
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex h-8 items-center rounded-mkt-sm px-3 text-[13px] font-[450] text-fog transition-colors duration-150 hover:text-bone"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          {signedIn ? (
            <Link href="/learn" className={marketingButtonClasses({ size: "sm" })}>
              Open the app
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className={marketingButtonClasses({
                  variant: "ghost",
                  size: "sm",
                  className: "hidden sm:inline-flex",
                })}
              >
                Sign in
              </Link>
              <Link href="/register" className={marketingButtonClasses({ size: "sm" })}>
                Get started
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-grid size-8 place-items-center rounded-mkt-sm border border-graphite bg-carbon text-mist transition-colors hover:border-smoke hover:text-bone lg:hidden"
          >
            {open ? (
              <X className="size-4" strokeWidth={2} />
            ) : (
              <Menu className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="site-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-graphite bg-void/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="mx-auto flex w-full max-w-[1200px] flex-col px-6 py-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center text-[14px] font-[510] text-mist"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {!signedIn && (
                <li>
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center text-[14px] font-[450] text-fog"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
