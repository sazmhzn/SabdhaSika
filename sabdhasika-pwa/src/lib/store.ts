"use client";

import { create } from "zustand";
import { getVocabulary } from "@/lib/data";
import { dayKey } from "@/lib/date";
import { applyRating, createProgress } from "@/lib/engine/scheduler";
import {
  buildDailySession,
  buildReviewSession,
  deriveQueue,
  isSessionComplete,
  ratingKey,
  type QueuedCard,
} from "@/lib/engine/session";
import { computeStats } from "@/lib/engine/stats";
import { registerCompletion } from "@/lib/engine/streak";
import { track } from "@/lib/metrics";
import { clearState, loadState, saveState } from "@/lib/persistence";
import { defaultState } from "@/lib/state";
import type {
  AppState,
  DailySession,
  Rating,
  RecallEntry,
  Settings,
  WordProgress,
} from "@/lib/types";

/** One reversible step, so "oops, wrong button" is never punishing. */
interface UndoStep {
  key: string;
  wordId: string;
  prevProgress: WordProgress | undefined;
  wasReview: boolean;
}

/** The same idea for the recall drill, which lives outside the daily session. */
interface RecallStep {
  wordId: string;
  at: string;
  prevProgress: WordProgress | undefined;
}

/** The recall log is a rolling window, not a permanent transcript. */
const MAX_RECALL_LOG = 500;
const MAX_RECALL_UNDO = 50;

interface StoreState {
  hydrated: boolean;
  /** The durable app state. */
  state: AppState;
  /** An ad-hoc session launched from the Review screen (not persisted). */
  reviewSession: DailySession | null;
  /** A milestone the learner has just crossed and not yet seen celebrated. */
  pendingMilestone: number | null;
  /** In-memory undo stack for the active session. */
  history: UndoStep[];
  /** In-memory undo stack for the active recall drill. */
  recallUndo: RecallStep[];
  /** Bumped on every rating so feedback effects can key off it. */
  ratingNonce: number;

  hydrate: () => Promise<void>;
  completeOnboarding: (patch: Partial<Settings>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  ensureDailySession: () => void;
  startReviewSession: (wordIds: string[]) => void;
  endReviewSession: () => void;
  rate: (card: QueuedCard, rating: Rating) => void;
  defer: (card: QueuedCard) => void;
  undoLast: () => void;
  /**
   * Record one active-recall attempt. Feeds the spaced-repetition scheduler
   * exactly like a rating does, but deliberately does *not* touch the streak:
   * the streak measures the daily ritual, and a bonus drill must not be able
   * to keep it alive on its own.
   */
  recordRecall: (wordId: string, remembered: boolean) => void;
  undoRecall: () => void;
  clearMilestone: () => void;
  markMilestoneSeen: (milestone: number) => void;
  resetProgress: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(state: AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveState(state);
  }, 160);
}

/**
 * Persist now, cancelling any pending debounce.
 *
 * For the handful of changes that are immediately followed by a navigation.
 * Onboarding is the one that matters: `completeOnboarding` used to debounce,
 * and the router navigated inside that 160ms window, so a reload — or, before
 * the fix below, the next route group's hydration — could read the state from
 * *before* onboarding had finished.
 */
function saveNow(state: AppState) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void saveState(state);
}

/**
 * One hydration for the whole tab, not one per provider mount.
 *
 * This matters because `AppProviders` is mounted by *route group*, not by the
 * root layout — see `(app)/layout.tsx`. Every navigation between groups unmounts
 * one and mounts another, so a naive `hydrate()` re-read the store from
 * IndexedDB on each of those transitions. That read can return a copy older
 * than what is already in memory (the save is debounced by 160ms), and
 * `set({ state: loaded })` then overwrote the newer state with it.
 *
 * The concrete symptom was the worst possible one: finish onboarding, get
 * redirected to `/learn`, and be bounced straight back to `/onboarding`
 * because the re-read had not seen `onboardedAt` yet.
 *
 * Memoising is correct rather than merely convenient: this store is the only
 * writer of the persisted copy, so re-reading it can never yield anything newer
 * than what is already in memory. Hydrate once per page load.
 */
let hydration: Promise<void> | null = null;

export const useStore = create<StoreState>((set, get) => ({
  hydrated: false,
  state: defaultState(),
  reviewSession: null,
  pendingMilestone: null,
  history: [],
  recallUndo: [],
  ratingNonce: 0,

  hydrate() {
    if (hydration) return hydration;

    const promise = (async () => {
      const loaded = (await loadState()) ?? defaultState();

      // Make sure today's session exists so the app is never in a half state.
      if (loaded.onboardedAt) {
        const plan = buildDailySession(loaded);
        if (!loaded.sessions[plan.session.date]) {
          loaded.sessions[plan.session.date] = plan.session;
        }
      }

      set({ state: loaded, hydrated: true, history: [] });
      scheduleSave(loaded);
    })();

    hydration = promise;
    return promise;
  },

  completeOnboarding(patch) {
    const state = get().state;
    const next: AppState = {
      ...state,
      onboardedAt: new Date().toISOString(),
      settings: { ...state.settings, ...patch },
    };
    const plan = buildDailySession(next);
    next.sessions[plan.session.date] = plan.session;
    set({ state: next, history: [] });
    /* Not debounced: this happens once, and the very next thing that happens is
       a navigation to `/learn`. See `saveNow`. */
    saveNow(next);
  },

  updateSettings(patch) {
    const state = get().state;
    const targetChanged =
      patch.targetLanguage !== undefined && patch.targetLanguage !== state.settings.targetLanguage;

    const next: AppState = { ...state, settings: { ...state.settings, ...patch } };

    // A new target language means a brand-new frequency list: rebuild today.
    // The streak is untouched — it measures the habit, not the language.
    if (targetChanged) {
      const plan = buildDailySession(next);
      next.sessions[plan.session.date] = plan.session;
    }

    set({ state: next, reviewSession: null, history: [] });
    scheduleSave(next);
  },

  ensureDailySession() {
    const state = get().state;
    const today = dayKey();
    if (state.sessions[today]) return;
    const plan = buildDailySession(state);
    const next = { ...state, sessions: { ...state.sessions, [plan.session.date]: plan.session } };
    set({ state: next, history: [] });
    scheduleSave(next);
  },

  startReviewSession(wordIds) {
    const state = get().state;
    const plan = buildReviewSession(state, wordIds);
    set({ reviewSession: plan.session, history: [] });
    track("review_start", { count: wordIds.length });
  },

  endReviewSession() {
    set({ reviewSession: null, history: [] });
  },

  rate(card, rating) {
    const { state, reviewSession, history } = get();
    const key = ratingKey(card);
    const active = reviewSession ?? state.sessions[dayKey()];
    if (!active) return;
    if (active.ratings[key]) return; // already answered — idempotent

    const now = new Date();
    const prev = state.progress[card.wordId] ?? createProgress(card.wordId, now);
    const nextProgress = applyRating(prev, card.wordId, rating, now);

    const nextSession: DailySession = {
      ...active,
      ratings: { ...active.ratings, [key]: rating },
      startedAt: active.startedAt ?? now.toISOString(),
    };

    const nextState: AppState = {
      ...state,
      progress: { ...state.progress, [card.wordId]: nextProgress },
    };

    const undoStep: UndoStep = {
      key,
      wordId: card.wordId,
      prevProgress: state.progress[card.wordId],
      wasReview: Boolean(reviewSession),
    };

    track("rating_given", { rating, wordId: card.wordId, pass: card.pass });

    const complete = isSessionComplete(nextSession);

    if (reviewSession) {
      set({
        state: nextState,
        reviewSession: complete ? { ...nextSession, completedAt: now.toISOString() } : nextSession,
        history: [...history, undoStep],
        ratingNonce: get().ratingNonce + 1,
      });
      if (complete) track("session_complete", { words: nextSession.wordIds.length, review: true });
      scheduleSave(nextState);
      return;
    }

    if (complete) {
      nextSession.completedAt = now.toISOString();
      nextState.streak = registerCompletion(nextState.streak, now);
      track("session_complete", { words: nextSession.wordIds.length });
    }

    nextState.sessions = { ...state.sessions, [nextSession.date]: nextSession };
    set({
      state: nextState,
      history: [...history, undoStep],
      ratingNonce: get().ratingNonce + 1,
    });
    scheduleSave(nextState);
  },

  defer(card) {
    const { state, reviewSession } = get();
    const active = reviewSession ?? state.sessions[dayKey()];
    if (!active) return;
    if (card.pass === 2) return; // the second-chance pass cannot be deferred

    const nextSession: DailySession = {
      ...active,
      deferrals: { ...(active.deferrals ?? {}), [card.wordId]: (active.deferrals?.[card.wordId] ?? 0) + 1 },
    };

    if (reviewSession) {
      set({ reviewSession: nextSession });
      return;
    }
    const next = { ...state, sessions: { ...state.sessions, [nextSession.date]: nextSession } };
    set({ state: next });
    scheduleSave(next);
  },

  undoLast() {
    const { state, reviewSession, history } = get();
    const step = history[history.length - 1];
    if (!step) return;

    const active = step.wasReview ? reviewSession : state.sessions[dayKey()];
    if (!active) return;

    const ratings = { ...active.ratings };
    delete ratings[step.key];
    // Reopening a finished session just clears the completion stamp. The day
    // still counts for the streak — the learner did finish it, then chose to
    // look at one card again. Retracting a streak here would be punitive.
    const nextSession: DailySession = { ...active, ratings, completedAt: undefined };

    const progress = { ...state.progress };
    if (step.prevProgress) progress[step.wordId] = step.prevProgress;
    else delete progress[step.wordId];

    const nextState: AppState = { ...state, progress };

    if (step.wasReview) {
      set({ state: nextState, reviewSession: nextSession, history: history.slice(0, -1) });
      return;
    }

    nextState.sessions = { ...state.sessions, [nextSession.date]: nextSession };
    set({ state: nextState, history: history.slice(0, -1) });
    scheduleSave(nextState);
  },

  recordRecall(wordId, remembered) {
    const { state, recallUndo } = get();
    const now = new Date();
    const prev = state.progress[wordId] ?? createProgress(wordId, now);
    const nextProgress = applyRating(prev, wordId, remembered ? "good" : "hard", now);
    const at = now.toISOString();

    const entry: RecallEntry = { at, wordId, date: dayKey(now), remembered };
    const recallLog = [...(state.recallLog ?? []), entry].slice(-MAX_RECALL_LOG);

    const nextState: AppState = {
      ...state,
      progress: { ...state.progress, [wordId]: nextProgress },
      recallLog,
    };

    track("recall_answered", { remembered, wordId });

    set({
      state: nextState,
      recallUndo: [...recallUndo, { wordId, at, prevProgress: state.progress[wordId] }].slice(
        -MAX_RECALL_UNDO,
      ),
    });
    scheduleSave(nextState);
  },

  undoRecall() {
    const { state, recallUndo } = get();
    const step = recallUndo[recallUndo.length - 1];
    if (!step) return;

    const progress = { ...state.progress };
    if (step.prevProgress) progress[step.wordId] = step.prevProgress;
    else delete progress[step.wordId];

    const recallLog = (state.recallLog ?? []).filter((e) => e.at !== step.at);
    const nextState: AppState = { ...state, progress, recallLog };

    set({ state: nextState, recallUndo: recallUndo.slice(0, -1) });
    scheduleSave(nextState);
  },

  clearMilestone() {
    set({ pendingMilestone: null });
  },

  markMilestoneSeen(milestone) {
    const state = get().state;
    if (state.celebratedMilestones.includes(milestone)) return;
    const next: AppState = {
      ...state,
      celebratedMilestones: [...state.celebratedMilestones, milestone],
    };
    set({ state: next });
    track("milestone_reached", { milestone });
    scheduleSave(next);
  },

  async resetProgress() {
    await clearState();
    const fresh = defaultState();
    fresh.settings = { ...get().state.settings };
    fresh.onboardedAt = get().state.onboardedAt;
    set({ state: fresh, reviewSession: null, pendingMilestone: null, history: [] });
    scheduleSave(fresh);
  },
}));

/* ------------------------------------------------------------------ *
 * Selectors — kept outside the store so components stay dumb.
 * ------------------------------------------------------------------ */

export function selectActiveSession(s: StoreState): DailySession | null {
  return s.reviewSession ?? s.state.sessions[dayKey()] ?? null;
}

export function useActiveSession(): DailySession | null {
  return useStore(selectActiveSession);
}

export function useQueue(): QueuedCard[] {
  return useStore((s) => {
    const active = selectActiveSession(s);
    return active ? deriveQueue(active) : [];
  });
}

export function useStats() {
  return useStore((s) => computeStats(s.state));
}

export function useSettings(): Settings {
  return useStore((s) => s.state.settings);
}

export function useTargetWords() {
  return useStore((s) => getVocabulary(s.state.settings.targetLanguage));
}
