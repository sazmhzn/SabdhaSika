"use client";

import { Send, Volume2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { Button } from "@/components/ui/Button";
import { sfx, speak, stopSpeaking } from "@/lib/audio";
import { useEffect } from "react";
import {
  appendMessage,
  cleanSpelledText,
  newMessage,
  offlineReply,
  type ChatMessage,
} from "@/lib/sign/conversation";

/**
 * Fingerspelling conversation.
 *
 * In-memory only: messages live in state, never in storage, so a chat can
 * neither complete a day nor move the streak. Sending is plain text
 * (what the learner fingerspelled on the camera screen); the reply comes
 * from `/api/sign-chat`, or the static offline line when it cannot.
 */
export default function SignChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  useEffect(() => stopSpeaking, []);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    const clean = cleanSpelledText(input);
    if (!clean) return;
    sendingRef.current = true;
    setSending(true);
    sfx.tap();

    const mine = newMessage("you", clean);
    setMessages((prev) => appendMessage(prev, mine));
    setInput("");

    const history = [...messages, mine].slice(-9, -1).map((m) => ({ role: m.role, text: m.text }));
    let replyText: string | null = null;
    try {
      const res = await fetch("/api/sign-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reply?: unknown };
        replyText = typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : null;
      }
    } catch {
      replyText = null;
    }
    setMessages((prev) => appendMessage(prev, newMessage("friend", replyText ?? offlineReply())));
    sendingRef.current = false;
    setSending(false);
  }, [input, messages]);

  const readAloud = useCallback((text: string) => {
    speak({ text, bcp47: "en-US" });
    sfx.tap();
  }, []);

  const clean = cleanSpelledText(input);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="American Sign Language"
        title="Conversation"
        trailing={
          <Link
            href="/sign"
            className="press text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            Fingerspelling
          </Link>
        }
      />

      <section
        aria-live="polite"
        className="rounded-panel border border-line bg-paper pad-panel min-h-[220px]"
      >
        {messages.length === 0 ? (
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Say hello in fingerspelling</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Spell on the{" "}
              <Link href="/sign" className="font-semibold text-ink underline">
                camera screen
              </Link>
              , then type what you spelled here and send it. The reply reads back in
              English — nothing is stored and the streak never moves.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.role === "you"
                    ? "self-end rounded-chip bg-ink px-3 py-2 font-mono text-[14px] font-semibold tracking-[0.06em] text-paper"
                    : "self-start rounded-chip border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink"
                }
              >
                {m.text}
                {m.role === "friend" && (
                  <button
                    type="button"
                    onClick={() => readAloud(m.text)}
                    aria-label="Read reply aloud"
                    className="press ml-2 inline-flex items-center gap-1 align-middle text-[11.5px] font-semibold text-muted hover:text-ink"
                  >
                    <Volume2 className="size-3.5" strokeWidth={2.2} />
                    Speak
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, 200))}
          placeholder="What you spelled, e.g. HELLO"
          aria-label="What you fingerspelled"
          autoComplete="off"
          maxLength={200}
          className="h-11 min-w-0 flex-1 rounded-row border border-line bg-surface px-3 font-mono text-[15px] font-semibold tracking-[0.06em] text-ink placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:tracking-normal placeholder:text-faint"
        />
        <Button type="submit" disabled={!clean || sending}>
          <Send className="size-4" strokeWidth={2.2} />
          {sending ? "Sending…" : "Send"}
        </Button>
      </form>

      <p className="mt-2 px-1 text-[11px] text-faint">
        Letters A–Z and spaces only. J and Z need motion and cannot be recognised yet.
      </p>
    </div>
  );
}
