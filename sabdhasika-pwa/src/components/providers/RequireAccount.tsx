"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccountStore } from "@/lib/account-store";

/**
 * Gate for the authenticated experience.
 *
 * The sibling of `RequireOnboarding`, and deliberately the same shape: decide
 * once, after hydration, render nothing while deciding. The boot splash is
 * still on screen at that point, so there is no flash of the wrong thing.
 *
 * The intended destination is carried in `?next=`, so signing in returns the
 * learner to the screen they asked for rather than dumping them on the home
 * screen. It is validated on the way back in (`safeNext`) — an open redirect
 * is a real bug even when the only destination is your own app.
 */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const hydrated = useAccountStore((s) => s.hydrated);
  const session = useAccountStore((s) => s.session);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || session) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/signin${next}`);
  }, [hydrated, session, pathname, router]);

  if (!hydrated || !session) return null;
  return <>{children}</>;
}

/**
 * Only same-origin, absolute paths are accepted. Anything else — a protocol,
 * a `//host`, a backslash — falls back to the app home, so `?next=` can never
 * be used to bounce a signed-in learner off-site.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/learn";
  if (!value.startsWith("/")) return "/learn";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/learn";
  if (value.includes("://")) return "/learn";
  return value;
}
