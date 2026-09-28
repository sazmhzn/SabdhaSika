import { AppProviders } from "@/components/providers/AppProviders";
import { RequireAccount } from "@/components/providers/RequireAccount";
import { RequireOnboarding } from "@/components/providers/RequireOnboarding";

/**
 * The full-screen learning session.
 *
 * It has no navigation chrome on purpose — the session is the product, and
 * the exit is a deliberate action rather than a tab away.
 *
 * `RequireOnboarding` is here to close a latent hole rather than for
 * decoration: without a target language there is no queue, and the page's
 * `!session` branch renders a skeleton that would never resolve. A learner who
 * reaches this route before finishing the first run is now sent to finish it.
 */
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <RequireAccount>
        <RequireOnboarding>{children}</RequireOnboarding>
      </RequireAccount>
    </AppProviders>
  );
}
