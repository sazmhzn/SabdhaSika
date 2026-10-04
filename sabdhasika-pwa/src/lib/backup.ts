import { migrate } from "@/lib/state";
import type { AppState } from "@/lib/types";

/**
 * Backup: a plain JSON file the learner owns.
 *
 * The app is local-only, so "back up your progress" means "give the learner a
 * file they can keep" — not an account on a server. The envelope carries a
 * `kind` marker so importing an unrelated JSON file fails cleanly instead of
 * silently wiping progress.
 */

export const BACKUP_KIND = "sabdhasika.backup";
export const BACKUP_VERSION = 1;

interface BackupEnvelope {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  state: AppState;
}

export function createBackup(state: AppState, now: Date = new Date()): string {
  const envelope: BackupEnvelope = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

export type BackupParseResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string };

/** Parse a backup file. Any older/partial blob inside is run through `migrate`. */
export function parseBackup(text: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "That file isn't a SabdhaSika backup." };
  }

  const envelope = parsed as { kind?: unknown; state?: unknown };
  if (envelope.kind !== BACKUP_KIND || !envelope.state || typeof envelope.state !== "object") {
    return { ok: false, error: "That file isn't a SabdhaSika backup." };
  }

  return { ok: true, state: migrate(envelope.state) };
}
