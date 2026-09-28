import type { Metadata } from "next";
import { AuthForm } from "@/components/marketing/AuthForm";
import { AuthSplit } from "@/components/marketing/AuthSplit";

/**
 * Sign in.
 *
 * The `next` parameter is the return path a guarded route appended before it
 * bounced the visitor here (`RequireAccount`). It is validated in `safeNext`
 * before it is ever used as a destination — an unvalidated `next` is an open
 * redirect, which on a site with a sign-in form is exactly the link a phishing
 * page wants to hand out.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to SabdhaSika and pick up today's words.",
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthSplit
      eyebrow="Welcome back"
      title={
        <>
          Sign in and pick up
          <br />
          where you <span className="text-white">stopped</span>.
        </>
      }
      lede="Your account lives on this device, so there is nothing to confirm and nothing to wait for. Today's words are already chosen."
    >
      <AuthForm mode="signin" next={next} />
    </AuthSplit>
  );
}
