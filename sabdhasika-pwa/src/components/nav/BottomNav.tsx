"use client";

import { BookOpen, Brain, Hand, Layers, Settings2, TrendingUp } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ArcNav, type ArcNavItem } from "@/components/nav/ArcNav";

export const NAV_ITEMS: readonly ArcNavItem[] = [
  { href: "/learn", label: "Learn", icon: BookOpen, hint: "Today's words" },
  { href: "/recall", label: "Recall", icon: Brain, hint: "Say it from memory" },
  { href: "/sign", label: "Sign", icon: Hand, hint: "Read fingerspelling" },
  { href: "/review", label: "Review", icon: Layers, hint: "Words needing attention" },
  { href: "/progress", label: "Progress", icon: TrendingUp, hint: "How far you've come" },
  { href: "/settings", label: "Settings", icon: Settings2, hint: "Language and preferences" },
];

/**
 * Mobile navigation.
 *
 * The active index is *derived from the route*, which is what makes the bar
 * respond to more than a tap: a deep link, the browser's back button, a
 * redirect out of a completed session, or any `router.push` anywhere in the
 * app all move the indicator, because they all change `pathname`. The bar
 * itself owns no index — it is handed one.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  /* `-1` when the route matches none of the five, so the indicator hides
     rather than parking itself on the wrong section.
     This is a guard, not a path the app currently takes: `/session` and
     `/onboarding` are full-screen and render no shell at all, and every route
     that *does* mount this bar is one of the five. It is kept because adding a
     sixth screen under `(app)` would otherwise mis-highlight its neighbour
     silently. */
  const activeIndex = NAV_ITEMS.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const onSelect = useCallback(
    (_index: number, item: ArcNavItem) => router.push(item.href),
    [router],
  );

  return <ArcNav items={NAV_ITEMS} activeIndex={activeIndex} onSelect={onSelect} />;
}
