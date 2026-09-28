"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { useAccountStore } from "@/lib/account-store";

/**
 * Who is signed in, and the way out.
 *
 * This is the piece of the account that only exists on desktop. On a phone the
 * identity belongs on the Settings screen, where there is room for it; a
 * persistent sidebar can carry it instead, which means the answer to "am I
 * signed in as the right person" is always on screen rather than two taps away.
 *
 * ── Why signing out has no confirmation ─────────────────────────────
 *
 * Because nothing is lost. Progress, the streak and the session history are
 * separate keys and survive a sign-out — the only thing that changes is which
 * account the device is pointed at, and the account record itself stays so the
 * sign-in form can pre-fill it. Asking "are you sure?" before a reversible,
 * consequence-free action trains people to click through dialogs.
 *
 * Sign-out does not navigate. Dropping the session makes `RequireAccount`
 * redirect to `/signin?next=…`, which is the same rule that handles a session
 * expiring any other way — one path instead of two, and it means signing back
 * in returns you to the screen you left.
 */
export function AccountCard() {
  const session = useAccountStore((s) => s.session);
  const hydrated = useAccountStore((s) => s.hydrated);
  const signOut = useAccountStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  /* Unreachable in practice — `RequireAccount` does not render the shell
     without a session — but the sidebar should not depend on that, and the
     skeleton keeps the column from jumping if the read is ever slow. */
  if (!hydrated || !session) {
    return <div className="h-[62px] rounded-panel border border-line bg-surface" aria-hidden="true" />;
  }

  const initial = (session.displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-panel border border-line bg-surface grain relative isolate overflow-hidden px-3 py-2.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[14px] font-bold text-paper"
        aria-hidden="true"
      >
        {initial}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">
          {session.displayName}
        </span>
        <span className="block truncate text-[11.5px] text-faint">{session.email}</span>
      </span>

      <IconButton
        label="Sign out"
        size="sm"
        tone="plain"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
      >
        <LogOut className="size-4" strokeWidth={2.2} />
      </IconButton>
    </div>
  );
}
