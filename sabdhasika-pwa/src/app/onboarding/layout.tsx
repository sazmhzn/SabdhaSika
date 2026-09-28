import { AppProviders } from "@/components/providers/AppProviders";
import { RequireAccount } from "@/components/providers/RequireAccount";

/**
 * The five-step first run.
 *
 * Account, then onboarding — that is the funnel the landing page opens, so a
 * signed-out visitor is sent to sign in rather than being allowed to pick a
 * language for an account that does not exist yet. The account is created
 * first and the progress follows it, which also means the register screen can
 * honestly promise that anything already on this device will still be here.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <RequireAccount>{children}</RequireAccount>
    </AppProviders>
  );
}
