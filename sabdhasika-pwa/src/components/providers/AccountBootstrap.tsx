"use client";

import { useEffect } from "react";
import { useAccountStore } from "@/lib/account-store";

/**
 * Reads the account on the pages that are *not* behind `AppProviders`.
 *
 * The marketing and auth pages are deliberately static — they paint from the
 * server with no splash, because a landing page that waits on IndexedDB before
 * showing anything is a landing page that has already lost. But they still need
 * to know whether someone is signed in: the nav has to offer "Open the app"
 * rather than "Get started", and the sign-in form pre-fills the address.
 *
 * So this renders nothing and gates nothing. It starts the read and lets the
 * page paint immediately; the few components that care subscribe to the store
 * and settle when the read lands. The difference from `AppProviders` is the
 * whole point: there, the answer is required to render; here, it is a nicety.
 */
export function AccountBootstrap() {
  const hydrate = useAccountStore((s) => s.hydrate);

  useEffect(() => {
    /* `hydrate` is memoised in the store, so StrictMode's double-invoke and any
       additional caller are both free. */
    void hydrate();
  }, [hydrate]);

  return null;
}
