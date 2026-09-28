"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { AccountCard } from "@/components/nav/AccountCard";
import { NAV_ITEMS } from "@/components/nav/BottomNav";
import { StreakChip } from "@/components/celebrate/Flame";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";

/**
 * Desktop navigation.
 *
 * The spec is explicit that desktop must be an intentional layout rather than
 * a stretched phone. So: a real sidebar that can carry persistent context the
 * mobile bar cannot — the current language, the streak, and where the learner
 * is in the frequency list. None of that has to be re-stated on the pages.
 */
export function SideNav() {
  const pathname = usePathname();
  const streak = useStore((s) => s.state.streak.current);
  const target = useStore((s) => s.state.settings.targetLanguage);
  const learned = useStore((s) => Object.values(s.state.progress).filter((p) => p.status !== "new").length);

  return (
    <aside className="sticky top-0 hidden h-svh w-[268px] shrink-0 flex-col border-r border-line px-5 py-7 lg:flex">
      <Link href="/learn" className="chrome-noselect rounded-chip" aria-label="SabdhaSika home">
        <BrandMark />
      </Link>

      <nav aria-label="Primary" className="mt-9 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, hint }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press chrome-noselect group relative flex items-center gap-3 rounded-row px-4 py-3",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="side-nav-active"
                  className="absolute inset-0 rounded-row border border-line bg-surface"
                  transition={{ type: "spring", stiffness: 460, damping: 38 }}
                />
              )}
              <Icon className="relative z-10 size-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
              <span className="relative z-10 min-w-0">
                <span className="block text-[14px] font-semibold">{label}</span>
                <span className="block truncate text-[11px] text-faint">{hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-panel border border-line bg-surface grain relative isolate overflow-hidden pad-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Current list
          </p>
          <p className="mt-2 text-[13px] font-semibold text-ink">
            {target.toUpperCase()} · top 3,000
          </p>
          <p className="mt-1 text-[11.5px] text-muted tabular-nums">
            {learned.toLocaleString()} words met
          </p>
        </div>
        <StreakChip days={streak} className="self-start" />
        {/* Desktop-only: on a phone the identity lives on Settings, where there
            is room for it. Here it can simply always be on screen. */}
        <AccountCard />
      </div>
    </aside>
  );
}
