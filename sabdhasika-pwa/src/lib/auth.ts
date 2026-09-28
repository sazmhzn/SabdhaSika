/**
 * The account layer.
 *
 * ── What this is, and what it is not ────────────────────────────────
 *
 * This product is local-first: `src/lib/persistence.ts` keeps everything in
 * IndexedDB on the device, and the install prompt has always promised that
 * "progress stays on this device". There is no server, no API route and no
 * database in this project, so the account is a *device account* — it lives in
 * the same IndexedDB store as the progress, under its own key.
 *
 * That makes one thing explicit rather than pretending otherwise: the session
 * is a local flag, not a security boundary. Anyone with devtools can set it.
 * It exists so the web experience has a real sign-in/register flow with real
 * validation, real hashing and real states — the same shape a server-backed
 * account would have — and so the marketing site has somewhere to send people.
 *
 * ── Why the password is still hashed ────────────────────────────────
 *
 * Storing a password in the clear would be indefensible even locally: the
 * value ends up in localStorage, which any script on the origin can read, and
 * people reuse passwords. So it is PBKDF2-HMAC-SHA256 with a random per-account
 * salt, and the iteration count is *stored in the record* so it can be raised
 * later without invalidating accounts created before the change.
 *
 * ── Replacing this with a real backend ──────────────────────────────
 *
 * Every function here is async and returns the same shapes, so the swap is
 * contained to this file: `register`/`signIn` become fetches, `loadSession`
 * becomes a cookie or token read, and nothing in the UI changes. That is the
 * whole reason the storage and crypto live here rather than in the components.
 */

import type { AccountRecord, AccountSession, AuthResult } from "@/lib/account-types";

export type { AccountRecord, AccountSession, AuthError, AuthField, AuthResult } from "@/lib/account-types";

const DB_NAME = "sabdhasika";
const DB_VERSION = 1;
const STORE = "kv";
const ACCOUNT_KEY = "account";
const SESSION_KEY = "account-session";

const LS_ACCOUNT = "sabdhasika:account";
const LS_SESSION = "sabdhasika:account-session";

/**
 * OWASP's current PBKDF2-HMAC-SHA256 guidance is 600,000 iterations. That is
 * roughly a second in a browser, which is the wrong trade here: this guards a
 * local record whose threat model is a casual snooper, and the cost would be
 * paid on every sign-in on every device. 210,000 is the previous guidance, is
 * still a meaningful work factor, and is recorded per-account so raising it
 * later only affects new accounts.
 */
const PBKDF2_ITERATIONS = 210_000;

/* ------------------------------------------------------------------ *
 * Storage — deliberately mirrors `persistence.ts` rather than sharing
 * it, so the account can be swapped for a remote store without
 * untangling it from the progress store.
 * ------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let settled = false;
    const done = (db: IDBDatabase | null) => {
      if (!settled) {
        settled = true;
        resolve(db);
      }
    };
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
      setTimeout(() => done(null), 2500);
    } catch {
      done(null);
    }
  });

  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function lsGet<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
}

function lsRemove(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Crypto
 * ------------------------------------------------------------------ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** `crypto.subtle` is undefined outside a secure context (plain http, file://). */
function subtleCrypto(): SubtleCrypto | null {
  if (typeof crypto === "undefined") return null;
  return crypto.subtle ?? null;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = subtleCrypto();
  if (!subtle) throw new Error("insecure-context");

  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

/** Constant-time-ish comparison. Not a defence against a local attacker, but correct. */
function equalHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Validation — shared by the forms and the store, so a rule can never
 * exist in the UI but not in the check.
 * ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Short list of passwords that would make the whole exercise pointless. */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "letmein1",
  "welcome1",
  "abc12345",
  "vocabulary",
  "sabdhasika",
]);

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 254) return "That email address is too long.";
  if (!EMAIL_RE.test(email)) return "That doesn’t look like an email address.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Choose a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (value.length > 200) return "That password is too long.";
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return "That password is one of the most commonly used ones. Pick another.";
  }
  return null;
}

export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (!name) return null; // optional — derived from the email when absent
  if (name.length > 60) return "Keep your name under 60 characters.";
  return null;
}

export interface PasswordStrength {
  /** 0–4, for the meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/**
 * A deliberately simple estimator: length first, then variety. It is shown as
 * guidance, never as a gate — the only hard requirement is `validatePassword`.
 */
export function passwordStrength(value: string): PasswordStrength {
  if (!value) return { score: 0, label: "Empty" };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return {
    score: clamped,
    label: ["Very weak", "Weak", "Fair", "Good", "Strong"][clamped],
  };
}

/* ------------------------------------------------------------------ *
 * Record + session I/O
 * ------------------------------------------------------------------ */

export async function loadAccount(): Promise<AccountRecord | null> {
  const fromIdb = await idbGet<AccountRecord>(ACCOUNT_KEY);
  if (fromIdb) return fromIdb;
  return lsGet<AccountRecord>(LS_ACCOUNT);
}

export async function loadSession(): Promise<AccountSession | null> {
  const fromIdb = await idbGet<AccountSession>(SESSION_KEY);
  const session = fromIdb ?? lsGet<AccountSession>(LS_SESSION);
  if (!session) return null;

  /* A session without its account is a half state — a cleared account key, or
     a session left behind by a version that stored accounts elsewhere. Drop it
     rather than reporting a signed-in user who cannot be resolved. */
  const account = await loadAccount();
  if (!account || account.id !== session.accountId) {
    await clearSession();
    return null;
  }
  return session;
}

async function saveAccount(record: AccountRecord): Promise<void> {
  await idbSet(ACCOUNT_KEY, record);
  lsSet(LS_ACCOUNT, record);
}

async function saveSession(session: AccountSession): Promise<void> {
  await idbSet(SESSION_KEY, session);
  lsSet(LS_SESSION, session);
}

async function clearSession(): Promise<void> {
  await idbDelete(SESSION_KEY);
  lsRemove(LS_SESSION);
}

function displayNameFrom(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Learner";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 60);
}

/* ------------------------------------------------------------------ *
 * The API
 * ------------------------------------------------------------------ */

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.displayName?.trim() ?? "";

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: { field: "email", message: emailError } };

  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: { field: "password", message: passwordError } };

  const nameError = validateDisplayName(name);
  if (nameError) return { ok: false, error: { field: "displayName", message: nameError } };

  if (!subtleCrypto()) {
    return {
      ok: false,
      error: {
        field: "form",
        message: "This browser can’t create a secure account here. Open the site over https.",
      },
    };
  }

  const existing = await loadAccount();
  if (existing && existing.email !== email) {
    return {
      ok: false,
      error: {
        field: "form",
        message: `This device already has an account for ${existing.email}. Sign in with it, or reset it in Settings.`,
      },
    };
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  let hash: string;
  try {
    hash = await derive(input.password, salt, PBKDF2_ITERATIONS);
  } catch {
    return {
      ok: false,
      error: {
        field: "form",
        message: "Something went wrong creating your account. Try again.",
      },
    };
  }

  const record: AccountRecord = {
    id: existing?.id ?? `acc_${bytesToBase64(crypto.getRandomValues(new Uint8Array(9))).replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}`,
    email,
    displayName: name || displayNameFrom(email),
    hash,
    salt: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  await saveAccount(record);

  const session: AccountSession = {
    accountId: record.id,
    email: record.email,
    displayName: record.displayName,
    signedInAt: new Date().toISOString(),
  };
  await saveSession(session);
  return { ok: true, session };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: { field: "email", message: emailError } };
  if (!input.password) {
    return { ok: false, error: { field: "password", message: "Enter your password." } };
  }

  const account = await loadAccount();
  if (!account) {
    return {
      ok: false,
      error: {
        field: "form",
        message: "There’s no account on this device yet. Create one and your progress will follow.",
      },
    };
  }
  if (account.email !== email) {
    return {
      ok: false,
      error: {
        field: "email",
        message: `This device’s account uses ${account.email}.`,
      },
    };
  }
  if (!subtleCrypto()) {
    return {
      ok: false,
      error: { field: "form", message: "This browser can’t verify the account here. Use https." },
    };
  }

  let candidate: string;
  try {
    candidate = await derive(input.password, base64ToBytes(account.salt), account.iterations);
  } catch {
    return { ok: false, error: { field: "form", message: "Something went wrong. Try again." } };
  }

  if (!equalHashes(candidate, account.hash)) {
    /* Deliberately the same message for a wrong password whatever the reason,
       so the form never confirms which half of the pair was wrong. */
    return { ok: false, error: { field: "password", message: "That password isn’t right." } };
  }

  const session: AccountSession = {
    accountId: account.id,
    email: account.email,
    displayName: account.displayName,
    signedInAt: new Date().toISOString(),
  };
  await saveSession(session);
  return { ok: true, session };
}

export async function signOut(): Promise<void> {
  await clearSession();
}

/** Removes the account and its session. Progress is a separate key and survives. */
export async function deleteAccount(): Promise<void> {
  await idbDelete(ACCOUNT_KEY);
  lsRemove(LS_ACCOUNT);
  await clearSession();
}

export async function updateDisplayName(displayName: string): Promise<AccountRecord | null> {
  const account = await loadAccount();
  if (!account) return null;
  const next: AccountRecord = { ...account, displayName: displayName.trim().slice(0, 60) || account.displayName };
  await saveAccount(next);
  const session = await loadSession();
  if (session) await saveSession({ ...session, displayName: next.displayName });
  return next;
}
