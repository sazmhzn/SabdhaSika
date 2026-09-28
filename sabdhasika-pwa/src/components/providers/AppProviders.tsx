"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAccountStore } from "@/lib/account-store";
import { primeVoices, setSoundEnabled, unlockAudio } from "@/lib/audio";
import { track } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import { BootSplash } from "@/components/providers/BootSplash";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdateToast } from "@/components/pwa/UpdateToast";

/**
 * Owns everything that has to happen exactly once, at the edges of the app:
 * hydration, theme, service worker, audio unlocking and app-open metrics.
 *
 * The splash is a real gate rather than a spinner: the store has to be
 * hydrated from IndexedDB before we know whether to show onboarding or
 * today's words, and showing the wrong one for 200ms is worse than a short,
 * branded hold. It is also where "time to first card" starts being measured.
 *
 * This is mounted by the *authenticated* route groups, not by the root layout.
 * The landing and auth pages are static and must paint immediately, so they
 * deliberately do not wait on IndexedDB — see `src/app/(marketing)/layout.tsx`.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const hydrateAccount = useAccountStore((s) => s.hydrate);
  const accountHydrated = useAccountStore((s) => s.hydrated);
  const theme = useStore((s) => s.state.settings.theme);
  const soundEnabled = useStore((s) => s.state.settings.soundEnabled);
  const reduceMotion = useStore((s) => s.state.settings.reduceMotion);
  const [updateReady, setUpdateReady] = useState<((reload: boolean) => void) | null>(null);
  const started = useRef(false);

  /* ── hydrate once ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("app_open", { online: navigator.onLine });
    /* Both stores, in parallel: the account decides whether to render at all,
       and the progress decides *what* to render, so waiting on them serially
       would double the splash for no reason. */
    void Promise.all([hydrate(), hydrateAccount()]);
  }, [hydrate, hydrateAccount]);

  /* ── sound switch ─────────────────────────────────────────────────── */
  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  /* ── explicit reduced-motion preference ───────────────────────────── */
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute(
      "data-reduce-motion",
      reduceMotion === "always" ? "true" : "false",
    );
  }, [hydrated, reduceMotion]);

  /* ── theme ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hydrated) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      document.documentElement.setAttribute("data-theme", resolved);
      const meta = document.querySelector('meta[name="theme-color"]:not([media])');
      const color = resolved === "dark" ? "#0a0a0b" : "#fbfbf9";
      if (meta) meta.setAttribute("content", color);
      else {
        const m = document.createElement("meta");
        m.name = "theme-color";
        m.content = color;
        document.head.appendChild(m);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, hydrated]);

  /* ── service worker + update prompt ───────────────────────────────── */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        const offer = (worker: ServiceWorker) => {
          setUpdateReady(() => (reload: boolean) => {
            worker.postMessage("SKIP_WAITING");
            if (reload) window.location.reload();
          });
        };
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              offer(installing);
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── audio needs a gesture before it will make a sound ────────────── */
  useEffect(() => {
    primeVoices();
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <MotionConfig
      reducedMotion={reduceMotion === "always" ? "always" : reduceMotion === "never" ? "never" : "user"}
    >
      {!hydrated || !accountHydrated ? <BootSplash /> : children}
      <InstallPrompt />
      <UpdateToast ready={updateReady} />
    </MotionConfig>
  );
}
