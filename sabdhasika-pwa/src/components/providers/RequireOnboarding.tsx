"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Gate for the tabbed app.
 *
 * A returning learner must never see onboarding again, and a first-time
 * learner must never land on an empty Learn screen. This decides once, after
 * hydration, and renders nothing while it decides — the boot splash is still
 * on screen at that point, so there is no flash of the wrong thing.
 */
export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => Boolean(s.state.onboardedAt));
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) return null;
  return <>{children}</>;
}
