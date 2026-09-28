"use client";

import { create } from "zustand";
import * as auth from "@/lib/auth";
import type { AccountRecord, AccountSession, AuthResult } from "@/lib/account-types";

/**
 * The account store.
 *
 * Kept separate from `useStore` on purpose. That store is the *learning* state
 * — progress, sessions, the streak — and it is persisted under `app-state` with
 * its own `migrate()`. An identity is a different concern with a different
 * lifetime: signing out must not touch progress, and a schema migration of the
 * learning state must not be able to invalidate a credential.
 *
 * `hydrated` is separate from the app store's flag too, so a marketing page can
 * read the session without waiting on the (much larger) progress load.
 */
interface AccountStore {
  hydrated: boolean;
  /** The device account, if one has been created. */
  account: AccountRecord | null;
  /** The active session, if signed in. */
  session: AccountSession | null;
  /** True while a hash is being derived — PBKDF2 is deliberately slow. */
  busy: boolean;

  hydrate: () => Promise<void>;
  register: (input: { email: string; password: string; displayName?: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
}

/**
 * One hydration for the whole tab, not one per caller.
 *
 * Two very different trees now ask for this — `AppProviders` on every
 * authenticated screen, and the marketing layout on the landing and auth pages
 * — and React 19's StrictMode double-invokes effects in development, so a
 * naive `hydrate()` would open IndexedDB three or four times on a cold load.
 * Memoising the promise rather than a boolean also means the second caller
 * awaits the *same* read instead of racing it and setting state twice.
 */
let hydration: Promise<void> | null = null;

export const useAccountStore = create<AccountStore>((set) => ({
  hydrated: false,
  account: null,
  session: null,
  busy: false,

  hydrate() {
    if (hydration) return hydration;
    /* Both reads in parallel: they are independent keys, and on a cold
       IndexedDB open the round trip dominates. */
    hydration = Promise.all([auth.loadAccount(), auth.loadSession()]).then(([account, session]) => {
      set({ account, session, hydrated: true });
    });
    return hydration;
  },

  async register(input) {
    set({ busy: true });
    try {
      const result = await auth.register(input);
      if (result.ok) {
        const account = await auth.loadAccount();
        set({ account, session: result.session });
      }
      return result;
    } finally {
      set({ busy: false });
    }
  },

  async signIn(input) {
    set({ busy: true });
    try {
      const result = await auth.signIn(input);
      if (result.ok) {
        const account = await auth.loadAccount();
        set({ account, session: result.session });
      }
      return result;
    } finally {
      set({ busy: false });
    }
  },

  async signOut() {
    await auth.signOut();
    /* The account record stays — signing out is not deleting — so the sign-in
       form can greet the learner by name and pre-fill the address. */
    set({ session: null });
  },

  async deleteAccount() {
    await auth.deleteAccount();
    set({ account: null, session: null });
  },

  async setDisplayName(name) {
    const account = await auth.updateDisplayName(name);
    if (account) {
      const session = await auth.loadSession();
      set({ account, session });
    }
  },
}));

export function useSession(): AccountSession | null {
  return useAccountStore((s) => s.session);
}

export function useAccount(): AccountRecord | null {
  return useAccountStore((s) => s.account);
}

/** True once we know whether there is a session — not the same as being signed in. */
export function useAccountHydrated(): boolean {
  return useAccountStore((s) => s.hydrated);
}
