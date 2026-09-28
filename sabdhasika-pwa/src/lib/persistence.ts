import { migrate } from "@/lib/state";
import type { AppState } from "@/lib/types";

/**
 * Persistence: IndexedDB first (survives eviction pressure better, handles
 * larger datasets), localStorage as a synchronous fallback for private
 * browsing modes where IDB is unavailable.
 */

const DB_NAME = "sabdhasika";
const DB_VERSION = 1;
const STORE = "kv";
const STATE_KEY = "app-state";
const LS_KEY = "sabdhasika:app-state";

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
      // Safari can hang on open in private mode; don't let the app wait.
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

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
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

function lsRead(): AppState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

function lsWrite(state: AppState) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — nothing useful to do */
  }
}

export async function loadState(): Promise<AppState | null> {
  const fromIdb = await idbGet<AppState>(STATE_KEY);
  if (fromIdb) return migrate(fromIdb);
  const fromLs = lsRead();
  return fromLs ? migrate(fromLs) : null;
}

export async function saveState(state: AppState): Promise<void> {
  const ok = await idbSet(STATE_KEY, state);
  // Mirror to localStorage: it is what the service worker's offline shell and
  // any future sync layer can read synchronously.
  lsWrite(state);
  if (!ok) {
    // IDB unavailable — localStorage alone is the durable copy.
    return;
  }
}

export async function clearState(): Promise<void> {
  await idbDelete(STATE_KEY);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }
}

export const persistenceAvailable = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";
