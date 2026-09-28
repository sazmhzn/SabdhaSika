"use client";

import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { safeNext } from "@/components/providers/RequireAccount";
import { marketingButtonClasses } from "@/components/ui/button-classes";
import {
  passwordStrength,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import type { AuthField } from "@/lib/account-types";
import { useAccountStore } from "@/lib/account-store";
import { cn } from "@/lib/cn";

export type AuthMode = "signin" | "register";

/**
 * The sign-in and create-account form.
 *
 * ── What is shared and what is not ──────────────────────────────────
 *
 * The two flows differ in more than a heading, so the differences are explicit
 * rather than parameterised away:
 *
 * · Register runs the full password policy and shows a strength meter; sign-in
 *   only checks that something was typed. Applying `validatePassword` on sign-in
 *   would lock out anyone whose password predates a rule change — a real
 *   failure mode, and the reason the two branches are not merged.
 * · Register offers an optional display name and a shortcut if this device
 *   already has an account; sign-in pre-fills the address from that account.
 *
 * Everything else — the fields, the inline errors, the busy state, the return
 * path — is identical, which is why it is one component and not two.
 *
 * ── Navigation is a consequence, not an action ──────────────────────
 *
 * On success the form does *not* push a route. It lets the store update, and a
 * single effect redirects when a session appears. That way the same effect
 * covers a successful submit, a session that was already valid on mount, and a
 * session restored in another tab — one rule instead of three, and no way for
 * the handler and the effect to disagree about where to go.
 *
 * ── Why this does not use the app's `<Button>` ──────────────────────
 *
 * The app's primary button is ink-on-paper, which on this surface is a dark
 * button on a dark page — the app's button is *correct for the app*, and simply
 * wrong here. So the form takes the marketing recipe instead, which is the same
 * decision the landing page's buttons make. Everything else about the control
 * (the busy state, the disabled guard, `aria-busy`) is unchanged.
 */
export function AuthForm({ mode, next }: { mode: AuthMode; next?: string }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const session = useAccountStore((s) => s.session);
  const account = useAccountStore((s) => s.account);
  const hydrated = useAccountStore((s) => s.hydrated);
  const busy = useAccountStore((s) => s.busy);
  const register = useAccountStore((s) => s.register);
  const signIn = useAccountStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    email: `${uid}-email`,
    password: `${uid}-password`,
    strength: `${uid}-strength`,
  };

  /* Pre-fill from the device account once it is read. Sign-in especially: the
     account is on this device, so making someone retype their own address is
     pure friction. Runs once, and never overwrites what has been typed. */
  useEffect(() => {
    if (!hydrated || !account) return;
    setEmail((current) => current || account.email);
  }, [hydrated, account]);

  /* The single redirect rule. See the note above. */
  const destination = useMemo(() => safeNext(next), [next]);
  useEffect(() => {
    if (!hydrated || !session) return;
    router.replace(destination);
  }, [hydrated, session, destination, router]);

  const strength = useMemo(() => passwordStrength(password), [password]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    setSubmitted(true);

    /* Validate against the same functions the store uses, so a rule cannot
       exist in the form but not in the check — or the reverse. */
    const nextErrors: Partial<Record<AuthField, string>> = {};

    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;

    if (isRegister) {
      const passwordError = validatePassword(password);
      if (passwordError) nextErrors.password = passwordError;
      const nameError = validateDisplayName(displayName);
      if (nameError) nextErrors.displayName = nameError;
    } else if (!password) {
      nextErrors.password = "Enter your password.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    const result = isRegister
      ? await register({ email, password, displayName })
      : await signIn({ email, password });

    if (result.ok) return; // the effect above takes it from here

    if (result.error.field === "form") setFormError(result.error.message);
    else setErrors({ [result.error.field]: result.error.message });
  }

  /* A device account that does not match what is being typed is worth saying
     out loud: `register` refuses a second address, and `signIn` refuses a
     different one, so this is the moment to point at the right door. */
  const mismatch =
    hydrated && account && email.trim() && account.email !== email.trim().toLowerCase()
      ? account.email
      : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      {formError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-mkt-sm border border-coral/30 bg-coral/10 px-4 py-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={2} />
          <p className="text-[13px] leading-relaxed text-coral">{formError}</p>
        </div>
      )}

      {isRegister && (
        <Field
          id={ids.name}
          label="Your name"
          hint="Optional"
          error={submitted ? errors.displayName : undefined}
        >
          <input
            id={ids.name}
            name="name"
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex"
            aria-invalid={Boolean(submitted && errors.displayName)}
            aria-describedby={submitted && errors.displayName ? `${ids.name}-error` : undefined}
            className={inputClasses(Boolean(submitted && errors.displayName))}
          />
        </Field>
      )}

      <Field
        id={ids.email}
        label="Email"
        error={submitted ? errors.email : undefined}
        className={isRegister ? "mt-5" : ""}
      >
        <input
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={Boolean(submitted && errors.email)}
          aria-describedby={submitted && errors.email ? `${ids.email}-error` : undefined}
          className={inputClasses(Boolean(submitted && errors.email))}
        />
      </Field>

      <Field
        id={ids.password}
        label="Password"
        error={submitted ? errors.password : undefined}
        className="mt-5"
        hint={isRegister ? "At least 8 characters" : undefined}
      >
        <div className="relative">
          <input
            id={ids.password}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "Choose a password" : "Your password"}
            aria-invalid={Boolean(submitted && errors.password)}
            aria-describedby={[
              submitted && errors.password ? `${ids.password}-error` : null,
              isRegister ? ids.strength : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined}
            className={cn(inputClasses(Boolean(submitted && errors.password)), "pr-12")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-mkt-sm text-ash transition-colors hover:text-bone"
          >
            {showPassword ? (
              <EyeOff className="size-4" strokeWidth={2} />
            ) : (
              <Eye className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>

        {isRegister && password.length > 0 && (
          <div id={ids.strength} className="mt-3">
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-200",
                    segment <= strength.score
                      ? strength.score >= 3
                        ? "bg-pulse"
                        : strength.score === 2
                          ? "bg-signal"
                          : "bg-coral"
                      : "bg-graphite",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ash">
              Strength: <span className="font-[510] text-mist">{strength.label}</span>
            </p>
          </div>
        )}
      </Field>

      {mismatch && (
        <p className="mt-5 rounded-mkt-sm border border-graphite bg-obsidian px-4 py-3 text-[12.5px] leading-relaxed text-fog">
          This device already has an account for{" "}
          <span className="font-[510] text-mist">{mismatch}</span>.{" "}
          <Link
            href={isRegister ? "/signin" : "/register"}
            className="font-[510] text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-smoke"
          >
            {isRegister ? "Sign in instead" : "Create a different one"}
          </Link>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={marketingButtonClasses({ size: "lg", full: true, className: "mt-7" })}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            {isRegister ? "Creating your account" : "Signing you in"}
          </>
        ) : (
          <>
            {isRegister ? "Create account" : "Sign in"}
            <ArrowRight className="size-4" strokeWidth={2} />
          </>
        )}
      </button>

      <p className="mt-5 text-center text-[13px] text-fog">
        {isRegister ? "Already have an account on this device? " : "New here? "}
        <Link
          href={isRegister ? "/signin" : "/register"}
          className="font-[510] text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-smoke"
        >
          {isRegister ? "Sign in" : "Create one"}
        </Link>
      </p>

      {isRegister && (
        <p className="mt-6 flex items-start justify-center gap-2 text-center text-[12px] leading-relaxed text-ash">
          <Check className="mt-0.5 size-3.5 shrink-0 text-pulse" strokeWidth={2.5} aria-hidden="true" />
          <span>
            Your account is created on this device and never sent anywhere. Your password is
            hashed before it is stored.
          </span>
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Field scaffolding
 * ------------------------------------------------------------------ */

function inputClasses(invalid: boolean): string {
  return cn(
    "h-11 w-full rounded-mkt-sm border bg-carbon px-3.5 text-[14px] text-bone outline-none transition-colors",
    "placeholder:text-ash",
    "hover:border-smoke focus:border-smoke",
    invalid ? "border-coral/50" : "border-graphite",
  );
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[12.5px] font-[510] text-mist">
          {label}
        </label>
        {hint && <span className="text-[11.5px] text-ash">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12.5px] text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
