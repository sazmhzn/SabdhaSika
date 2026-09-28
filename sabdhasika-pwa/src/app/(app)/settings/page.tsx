"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { sfx, speechAvailable } from "@/lib/audio";
import { haptics, hapticsSupported } from "@/lib/haptics";
import { LANGUAGES, NATIVE_LANGUAGES, getLanguage } from "@/lib/languages";
import {
  METRIC_TARGETS,
  allEvents,
  clearMetrics,
  formatMs,
  formatPct,
  metricTone,
  summarize,
} from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { LanguageCode, NativeLanguageCode } from "@/lib/types";

export default function SettingsPage() {
  const settings = useStore((s) => s.state.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetProgress = useStore((s) => s.resetProgress);
  const wordsMet = useStore(
    (s) => Object.values(s.state.progress).filter((p) => p.status !== "new").length,
  );

  const [picker, setPicker] = useState<null | "target" | "native">(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const language = getLanguage(settings.targetLanguage);
  const native = NATIVE_LANGUAGES.find((n) => n.code === settings.nativeLanguage);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader eyebrow="Preferences" title="Settings" />

      {/* ── Learning ─────────────────────────────────────────────── */}
      <Section title="Learning">
        <Row
          label="I'm learning"
          value={language.name}
          hint={language.nativeName}
          glyph={language.glyph}
          reading={language.glyphReading}
          onClick={() => setPicker("target")}
        />
        <Divider />
        <Row
          label="Meanings in"
          value={native?.name ?? "English"}
          hint={native?.nativeName}
          onClick={() => setPicker("native")}
        />
        <Divider />
        <div className="px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">Words a day</p>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Today&rsquo;s session size. 20–30 is the sweet spot.
          </p>
          <Segmented
            className="mt-3"
            ariaLabel="Daily goal"
            value={String(settings.dailyGoal)}
            onChange={(v) =>
              updateSettings({ dailyGoal: Number(v) as 10 | 20 | 25 | 30 })
            }
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "25", label: "25" },
              { value: "30", label: "30" },
            ]}
          />
          <p className="mt-3 text-[11.5px] text-faint">
            Changing this rebuilds today&rsquo;s list. Words you have already rated today keep their
            progress.
          </p>
        </div>
      </Section>

      {/* ── Reading ──────────────────────────────────────────────── */}
      <Section title="Reading">
        <div className="px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">Romanization</p>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            {language.needsRomanization
              ? `Latin spelling under ${language.name} script — a support, not a crutch.`
              : `${language.name} already uses the Latin alphabet, so there is nothing to show.`}
          </p>

          <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Romanization">
            {(
              [
                { value: "always", label: "Always show", hint: "Helpful from day one" },
                {
                  value: "while-learning",
                  label: "Show while learning",
                  hint: "Fades out as words become familiar",
                },
                {
                  value: "hide-after-mastery",
                  label: "Hide after mastery",
                  hint: "Keeps it until a word is solid",
                },
                { value: "never", label: "Never show", hint: "Script only, from the start" },
              ] as const
            ).map((opt) => {
              const active = settings.romanization === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateSettings({ romanization: opt.value })}
                  className={cn(
                    "press chrome-noselect flex items-center gap-3 rounded-row border px-4 py-3 text-left",
                    active ? "border-ink bg-surface" : "border-line bg-paper hover:bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      active ? "border-ink bg-ink" : "border-line-strong",
                    )}
                    aria-hidden="true"
                  >
                    {active && <Check className="size-3 text-paper" strokeWidth={3.4} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{opt.label}</span>
                    <span className="block text-[11.5px] text-muted">{opt.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── Sound & feel ─────────────────────────────────────────── */}
      <Section title="Sound & feel">
        <div>
          <Toggle
            label="Pronunciation"
            description={
              speechAvailable()
                ? "Show the speaker on every card"
                : "Not available in this browser — the button will still appear"
            }
            checked={settings.pronunciationEnabled}
            onChange={(v) => updateSettings({ pronunciationEnabled: v })}
          />
          <Divider />
          <Toggle
            label="Play automatically on new words"
            description="Hear a word the first time you meet it"
            checked={settings.autoPlayPronunciation}
            disabled={!settings.pronunciationEnabled}
            onChange={(v) => updateSettings({ autoPlayPronunciation: v })}
          />
          <Divider />
          <Toggle
            label="Haptics"
            description={
              hapticsSupported()
                ? "A small tick when you rate a card"
                : "This device doesn't report a vibration motor"
            }
            checked={settings.hapticsEnabled}
            onChange={(v) => {
              updateSettings({ hapticsEnabled: v });
              if (v) haptics.tick(true);
            }}
          />
          <Divider />
          <Toggle
            label="Answer sounds"
            description="Short, quiet tones for correct and missed answers"
            checked={settings.soundEnabled}
            onChange={(v) => {
              updateSettings({ soundEnabled: v });
              if (v) sfx.correct();
            }}
          />
        </div>
      </Section>

      {/* ── Appearance ───────────────────────────────────────────── */}
      <Section title="Appearance">
        <div className="px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">Theme</p>
          <Segmented
            className="mt-3"
            ariaLabel="Theme"
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v as typeof settings.theme })}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
        <Divider />
        <div className="px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">Motion</p>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Animations follow your system preference by default.
          </p>
          <Segmented
            className="mt-3"
            ariaLabel="Motion"
            value={settings.reduceMotion}
            onChange={(v) => updateSettings({ reduceMotion: v as typeof settings.reduceMotion })}
            options={[
              { value: "system", label: "System" },
              { value: "always", label: "Reduced" },
              { value: "never", label: "Full" },
            ]}
          />
        </div>
      </Section>

      {/* ── Delight metrics ──────────────────────────────────────── */}
      <MetricsPanel />

      {/* ── Data ─────────────────────────────────────────────────── */}
      <Section title="Your data">
        <div className="px-4 py-4">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Everything — progress, streak, session history — lives on this device in IndexedDB.
            Nothing is uploaded. {wordsMet.toLocaleString()} words met so far.
          </p>
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 className="size-4" strokeWidth={2.2} />
            Reset all progress
          </Button>
        </div>
      </Section>

      <div className="mt-8 flex flex-col items-center gap-3 pb-4">
        <BrandMark showWordmark={false} size={40} />
        <p className="text-center text-[11.5px] leading-relaxed text-faint">
          SabdhaSika · <span className="font-serif italic">śabda</span> (शब्द) means “word”.
          <br />
          Version 1.0.0 · built as an installable PWA
        </p>
      </div>

      {/* ── pickers ──────────────────────────────────────────────── */}
      <Sheet
        open={picker === "target"}
        onClose={() => setPicker(null)}
        title="What do you want to learn?"
        description="Switching rebuilds today's list from the new frequency list."
      >
        <div className="grid max-h-[52svh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {LANGUAGES.map((l) => {
            const active = l.code === settings.targetLanguage;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  updateSettings({ targetLanguage: l.code as LanguageCode });
                  setPicker(null);
                }}
                className={cn(
                  "press chrome-noselect flex flex-col items-start gap-2 rounded-row border p-3 text-left",
                  active ? "border-ink bg-surface" : "border-line bg-paper hover:bg-surface",
                )}
              >
                <GlyphTile glyph={l.glyph} reading={l.glyphReading} size={40} dense />
                <span className="text-[13px] font-semibold text-ink">{l.name}</span>
                <span className="-mt-2 text-[10.5px] text-muted">{l.blurb}</span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={picker === "native"}
        onClose={() => setPicker(null)}
        title="Meanings in which language?"
      >
        <div className="flex flex-wrap gap-2">
          {NATIVE_LANGUAGES.map((n) => {
            const active = n.code === settings.nativeLanguage;
            return (
              <button
                key={n.code}
                type="button"
                onClick={() => {
                  updateSettings({ nativeLanguage: n.code as NativeLanguageCode });
                  setPicker(null);
                }}
                className={cn(
                  "press chrome-noselect inline-flex items-center gap-2 rounded-full border px-4 py-3 text-[13.5px] font-semibold",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-ink-soft hover:text-ink",
                )}
              >
                {n.name}
                <span className={cn("text-[11px]", active ? "text-paper/60" : "text-faint")}>
                  {n.nativeName}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset everything?"
        description="This erases your progress, streak and session history on this device. It cannot be undone."
      >
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmReset(false)}>
            Keep my progress
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await resetProgress();
              setConfirmReset(false);
            }}
          >
            <RotateCcw className="size-4" strokeWidth={2.2} />
            Reset
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Delight metrics panel
 *
 * The strategy document names a metric for every delight hypothesis. This is
 * where those numbers are visible — on the device, never uploaded — so the
 * team can see whether a change actually landed instead of arguing about it.
 * ------------------------------------------------------------------ */

function MetricsPanel() {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => summarize(allEvents()), [tick]);

  const rows = [
    {
      key: "timeToFirstCardMs" as const,
      value: summary.timeToFirstCardMs,
      display: formatMs(summary.timeToFirstCardMs),
      target: "≤ 1.5s",
    },
    {
      key: "medianRatingGapMs" as const,
      value: summary.medianRatingGapMs,
      display: formatMs(summary.medianRatingGapMs),
      target: "≤ 12s",
    },
    {
      key: "hardRate" as const,
      value: summary.hardRate,
      display: formatPct(summary.hardRate),
      target: "≤ 25%",
    },
    {
      key: "sessionCompletionRate" as const,
      value: summary.sessionCompletionRate,
      display: formatPct(summary.sessionCompletionRate),
      target: "≥ 70%",
    },
    {
      key: "recallAccuracy" as const,
      value: summary.recallAccuracy,
      display: formatPct(summary.recallAccuracy),
      target: "≥ 60%",
    },
  ];

  const tones = {
    good: "text-good bg-good-soft",
    warn: "text-accent bg-accent-soft",
    bad: "text-bad bg-bad-soft",
    none: "text-faint bg-surface",
  } as const;

  return (
    <Section title="Delight metrics">
      <div className="px-4 py-4">
        <p className="text-[13px] leading-relaxed text-muted">
          Local, anonymous signals that tell us whether the interaction design is working. Nothing
          leaves this device.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-panel border border-line bg-paper p-4">
              <p className="text-[10.5px] font-medium leading-tight text-muted">
                {METRIC_TARGETS[r.key].label}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span
                  className={cn(
                    "rounded-chip px-2 py-1 text-[15px] font-bold tabular-nums",
                    tones[metricTone(r.key, r.value)],
                  )}
                >
                  {r.display}
                </span>
              </p>
              <p className="mt-1 text-[10px] text-faint">target {r.target}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="press rounded-chip px-3 py-2 text-[12px] font-semibold text-muted hover:text-ink"
          >
            {open ? "Hide raw events" : `Raw events (${summary.totalEvents})`}
          </button>
          <button
            type="button"
            onClick={() => {
              clearMetrics();
              setTick((t) => t + 1);
            }}
            className="press ml-auto rounded-chip px-3 py-2 text-[12px] font-semibold text-muted hover:text-ink"
          >
            Clear
          </button>
        </div>

        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 max-h-56 overflow-y-auto rounded-panel border border-line bg-paper p-2"
          >
            {allEvents()
              .slice()
              .reverse()
              .slice(0, 80)
              .map((e, i) => (
                <li
                  key={`${e.at}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-chip px-2 py-2 text-[11px] odd:bg-surface/60"
                >
                  <span className="font-semibold text-ink-soft">{e.name}</span>
                  <span className="truncate text-faint">
                    {new Date(e.at).toLocaleTimeString()} · {e.data ? JSON.stringify(e.data) : ""}
                  </span>
                </li>
              ))}
            {summary.totalEvents === 0 && (
              <li className="px-2 py-3 text-center text-[11.5px] text-faint">
                No events yet — use the app and they will appear here.
              </li>
            )}
          </motion.ul>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
        {title}
      </h2>
      <div className="rounded-panel border border-line bg-paper">{children}</div>
    </section>
  );
}

function Divider() {
  return <span className="mx-4 block h-px bg-line" />;
}

function Row({
  label,
  value,
  hint,
  glyph,
  reading,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  glyph?: string;
  reading?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press chrome-noselect flex w-full items-center gap-4 rounded-row px-4 py-4 text-left"
    >
      {glyph && <GlyphTile glyph={glyph} reading={reading} size={40} dense />}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-muted">{label}</span>
        <span className="block text-[14.5px] font-semibold text-ink">
          {value}
          {hint && <span className="ml-2 text-[12px] font-normal text-faint">{hint}</span>}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={2.2} />
    </button>
  );
}
