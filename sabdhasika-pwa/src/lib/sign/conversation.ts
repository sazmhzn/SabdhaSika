/**
 * Fingerspelling conversation — in-memory message list.
 *
 * Deliberately not persisted: a conversation is not a session, it never
 * completes a day, and it must never touch progress, streak or recall
 * history. The chat lives as long as the page lives.
 */

/** One chat turn. `you` was fingerspelled on this device, `friend` replied. */
export interface ChatMessage {
  id: string;
  role: "you" | "friend";
  text: string;
  createdAt: number;
}

/** Maximum message text the chat will send. Keeps the request small. */
export const CHAT_TEXT_LIMIT = 200;

/** Maximum messages kept. Oldest are dropped, so the list cannot grow. */
export const CHAT_HISTORY_LIMIT = 50;

/** Fingerspelling produces A-Z; keep only that plus spaces when sending. */
export function cleanSpelledText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_TEXT_LIMIT);
}

export function newMessage(role: ChatMessage["role"], text: string): ChatMessage {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return { id, role, text, createdAt: Date.now() };
}

/** Append and cap. Returns a new list; the input is never mutated. */
export function appendMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...list, message].slice(-CHAT_HISTORY_LIMIT);
}

/**
 * Honest offline reply. Used when the chat endpoint is unconfigured or
 * unreachable — a static nudge, never a fake AI answer.
 */
export function offlineReply(): string {
  return "Nice spelling — I am offline, so I cannot reply yet. Your letters arrived; the answers need a connection.";
}
