import { AppShell } from "@/components/nav/AppShell";
import { AppProviders } from "@/components/providers/AppProviders";
import { RequireAccount } from "@/components/providers/RequireAccount";
import { RequireOnboarding } from "@/components/providers/RequireOnboarding";

/**
 * The tabbed, authenticated shell.
 *
 * Three gates, in this order and for these reasons:
 *
 *  1. `AppProviders` — hydration. Nothing below it can decide anything until
 *     both the account and the progress have been read out of IndexedDB.
 *  2. `RequireAccount` — you must be signed in to be here at all.
 *  3. `RequireOnboarding` — a signed-in learner who has not yet chosen a
 *     language and a goal has nothing to study, so they get the five-step
 *     first run rather than an empty Learn screen.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <RequireAccount>
        <RequireOnboarding>
          <AppShell>{children}</AppShell>
        </RequireOnboarding>
      </RequireAccount>
    </AppProviders>
  );
}
