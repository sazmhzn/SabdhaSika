"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/metrics";
import { useStore } from "@/lib/store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sabdhasika:install-dismissed";

/**
 * Install prompt.
 *
 * The timing is the whole feature. A browser install banner on first load is
 * asking for a commitment before delivering any value. This one waits until
 * the learner has *finished a session* — the moment they have actually felt
 * the product work — and then asks once, and never again if declined.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [offline, setOffline] = useState(false);

  const streak = useStore((s) => s.state.streak.current);
  const sessions = useStore((s) => s.state.sessions);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setOpen(false);
      track("install_accepted");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Trigger: at least one completed session, and not previously declined.
  useEffect(() => {
    if (!deferred || dismissed || open) return;
    const completed = Object.values(sessions).some((s) => s.completedAt);
    if (!completed && streak === 0) return;
    const t = setTimeout(() => {
      setOpen(true);
      track("install_prompt_shown");
    }, 1400);
    return () => clearTimeout(t);
  }, [deferred, dismissed, open, sessions, streak]);

  /* Offline badge — small, honest, never a modal. */
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") track("install_accepted");
    else dismiss();
    setDeferred(null);
    setOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-safe"
          >
            <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-paper/90 px-3 py-2 text-[11px] font-semibold text-muted shadow-nav backdrop-blur">
              <WifiOff className="size-3.5" strokeWidth={2.3} />
              Offline — today&rsquo;s words still work
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={open}
        onClose={dismiss}
        title="Keep it one tap away"
        description="Install SabdhaSika and today's words open instantly, even without a signal."
      >
        <div className="flex items-center gap-4 rounded-panel border border-line bg-surface grain relative isolate overflow-hidden pad-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={52}
            height={52}
            className="size-13 rounded-panel"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">SabdhaSika</p>
            <p className="mt-1 text-[12px] leading-snug text-muted">
              Full screen. No browser bar. Works offline.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {[
            { icon: WifiOff, text: "Today's session runs with no connection" },
            { icon: Download, text: "Progress stays on this device" },
            { icon: RefreshCw, text: "Opens in a single tap from your home screen" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[13px] text-ink-soft">
              <Icon className="size-4 shrink-0 text-muted" strokeWidth={2} />
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" onClick={dismiss} className="flex-1">
            Not now
          </Button>
          <Button onClick={install} className="flex-1">
            Install
          </Button>
        </div>
      </Sheet>
    </>
  );
}
