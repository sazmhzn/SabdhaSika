import type { Metadata } from "next";
import { AuthForm } from "@/components/marketing/AuthForm";
import { AuthSplit } from "@/components/marketing/AuthSplit";
import { COVERAGE_LANGUAGE_COUNT } from "@/lib/corpus-facts";

/**
 * Create an account.
 *
 * The funnel the landing page opens: account first, then onboarding. That order
 * is deliberate — the register screen can then honestly promise that anything
 * already on the device will still be there afterwards, because the account is
 * written beside the progress rather than over it. Doing onboarding first would
 * mean asking someone to invest effort before there is anywhere to attach it.
 */
export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a SabdhaSika account on your device and start learning the most frequent words first.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthSplit
      eyebrow="Get started"
      title={
        <>
          Create your account
          <br />
          in one <span className="text-white">field</span>.
        </>
      }
      lede={`No email confirmation and no server. ${COVERAGE_LANGUAGE_COUNT} languages are waiting, and your progress stays on this device — which is also why it keeps working offline.`}
    >
      <AuthForm mode="register" next={next} />
    </AuthSplit>
  );
}
