import { NextResponse } from "next/server";
import { CHAT_TEXT_LIMIT } from "@/lib/sign/conversation";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Sign chat — one fingerspelled message in, one friendly reply out.
 *
 * Same privacy boundary as Word Help: the body carries a short text and
 * optionally the visible turns, and nothing else. Progress, streak,
 * sessions, recall history, bookmarks, account and state are rejected
 * rather than ignored.
 *
 * Reuses the Word Help provider env (`WORD_HELP_API_KEY`,
 * `WORD_HELP_BASE_URL`, `WORD_HELP_MODEL`) — no new key to configure.
 * Unconfigured or failed means 503/502 and the client shows its static
 * offline reply. Replies are never cached: they depend on the turn.
 */

/** Fields that must never appear in the body. */
const FORBIDDEN = ["progress", "streak", "sessions", "recallLog", "bookmarks", "state"];

const SYSTEM_PROMPT = [
  "You are a friendly practice friend for someone learning ASL fingerspelling.",
  "They fingerspell slowly, letter by letter, so their message is short and in capitals.",
  "",
  "Rules:",
  "- Reply in plain everyday English, at most two short sentences.",
  "- If their message is unclear, guess kindly and ask one short follow-up.",
  "- Say nothing about the learner, their progress, or the app.",
].join("\n");

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

interface Turn {
  role: "you" | "friend";
  text: string;
}

function cleanTurn(v: unknown): Turn | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  if (t.role !== "you" && t.role !== "friend") return null;
  const text = str(t.text, CHAT_TEXT_LIMIT);
  if (!text) return null;
  return { role: t.role, text };
}

function isConfigured(): boolean {
  return Boolean(process.env.WORD_HELP_API_KEY);
}

async function fetchReply(message: string, history: Turn[], signal: AbortSignal): Promise<string | null> {
  const key = process.env.WORD_HELP_API_KEY;
  const base = process.env.WORD_HELP_BASE_URL;
  if (!key || !base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.WORD_HELP_MODEL ?? "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 150,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-8).map((t) => ({
            role: t.role === "you" ? "user" : "assistant",
            content: t.text,
          })),
          { role: "user", content: message },
          { role: "user", content: 'Reply with JSON only: { "reply": string }' },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { reply?: unknown };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    return reply ? reply.slice(0, 500) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  for (const field of FORBIDDEN) {
    if (field in raw) {
      return NextResponse.json(
        { error: `Unexpected field "${field}". This endpoint takes a message and nothing else.` },
        { status: 400 },
      );
    }
  }

  const message = str(raw.message, CHAT_TEXT_LIMIT);
  if (!message) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }
  const history = Array.isArray(raw.history)
    ? raw.history.map(cleanTurn).filter((t): t is Turn => t !== null).slice(-8)
    : [];

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Sign chat is not configured on this deployment." },
      { status: 503 },
    );
  }

  const reply = await fetchReply(message, history, request.signal);
  if (!reply) {
    return NextResponse.json({ error: "No reply available." }, { status: 502 });
  }
  return NextResponse.json({ reply });
}
