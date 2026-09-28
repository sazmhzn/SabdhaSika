# SabdhaSika

**Learn the words that matter.** A frequency-based vocabulary PWA — 20–30 high-frequency words
a day, flashcards, recall, spaced review, and a visible march through a language's frequency list.

> `śabda` (शब्द) — *word*.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build (service worker active)
npm run typecheck    # tsc --noEmit
```

The service worker only registers in a production build, so run `npm run build && npm run start`
to exercise offline behaviour and the install prompt.

---

## What is here

| Route | Screen |
| --- | --- |
| `/` | **Landing page.** Purpose, the measured coverage evidence, the method, the ladder, languages, FAQ, CTA. |
| `/signin` | Sign in — a device account, with a validated return path |
| `/register` | Create an account — one field, then onboarding |
| `/onboarding` | Five-step first run: promise → target language → native language → daily goal → ready |
| `/learn` | Home. One number dominates: words left today, plus the first 20 words in corpus order. |
| `/session` | **The flashcard experience.** Full screen, no navigation. |
| `/recall` | **The recall drill.** A meaning, a sentence with the word blanked out, and you produce it. |
| `/review` | Words needing attention, bucketed by why they need it |
| `/progress` | Mastery, consistency and the frequency ladder |
| `/settings` | Language, goal, romanization, sound, motion, theme, delight metrics |
| `/offline` | Offline fallback shell |

`/` is prerendered as static HTML. `/signin` and `/register` are dynamic, because they read the
`?next=` return path from the query string.

---

## Architecture

The vocabulary dataset and the learning engine know nothing about React. A backend can be dropped
in behind `VocabularyRepository` without the UI changing.

```
src/
  app/                     Next.js App Router
    (marketing)/           Public site — no providers, no gates, static
      page.tsx             The landing page
      signin/ register/    Auth
    (app)/                 Tabbed shell (sidebar on desktop, pill nav on mobile)
      recall/              The recall drill (intro → drill → summary)
    session/               Full-screen learning session
    onboarding/
    layout.tsx             Fonts, metadata, theme bootstrap
    globals.css            Design tokens, spacing/radius scale, motion primitives
  components/
    marketing/             SiteNav, SiteFooter, Hero, Benefits, CoverageEvidence,
                           HowItWorks, Ladder, LanguageGrid, Faq, ClosingCta,
                           AuthSplit, AuthForm
    learn/                 Flashcard, pronunciation, recall inputs, rating bar
    celebrate/             Confetti, flame, session complete, milestones
    nav/                   AppShell, BottomNav (route → index), ArcNav, SideNav, AccountCard
    ui/                    Button, button-classes, GlyphTile, ProgressBar, Sheet, Segmented, Toggle
    pwa/                   Install prompt, update toast
    providers/             AppProviders, AccountBootstrap, BootSplash, RequireAccount, RequireOnboarding
  lib/
    types.ts               Domain types — UI-agnostic
    languages.ts           Language registry + frequency milestones
    corpus-facts.ts        Measured corpus coverage (regenerate with coverage.mjs)
    account-types.ts       Identity types — a different axis from the domain types
    auth.ts                The account layer: PBKDF2 hashing, storage, session
    account-store.ts       Zustand store for identity, separate from learning state
    data/                  Seed vocabulary, one file per language
    engine/
      scheduler.ts         Spaced repetition (SM-2 flavoured)
      session.ts           "Today's 25 words" — the mix algorithm
      recall.ts            Recall deck selection, blanking, recall strength
      stats.ts             Progress, review buckets, activity strip
      streak.ts            Streak with a grace day
      quiz.ts              Distractors, answer normalisation
    persistence.ts         IndexedDB with a localStorage fallback
    store.ts               Zustand store + selectors
    audio.ts               Speech synthesis + synthesised interface sounds
    haptics.ts             Vibration API wrapper
    metrics.ts             Local delight instrumentation
    romanization.ts        Visibility rules, hero sizing, RTL
    date.ts                Local-calendar helpers, seeded RNG
```

### Two trees, two sets of providers

The root layout renders `{children}` directly. Providers live in the route groups that need them:

- **`(app)`, `session` and `onboarding`** mount `AppProviders`, which gates the tree on an IndexedDB
  read and holds a boot splash while it does. `RequireAccount` then redirects to `/signin?next=…`
  if there is no session, and `RequireOnboarding` sends a signed-in learner with no target language
  to the wizard.
- **`(marketing)`** mounts none of that. A landing page that waits on IndexedDB before painting has
  already lost the visitor, so the only thing here is `AccountBootstrap`, which starts the account
  read without waiting for it. The nav and the forms subscribe and settle when it lands.

This is also why `/` can be static while `/learn` cannot.

### The account is local, and says so

There is no server in this project, so the account is a *device account*: it lives in the same
IndexedDB store as the progress, under its own key. It exists so the web experience has a real
sign-in/register flow — real validation, real hashing, real error and loading states — rather than
a fake one, and so the landing page has somewhere honest to send people.

Three decisions worth knowing:

- **The password is still hashed.** PBKDF2-HMAC-SHA256, 210,000 iterations, a random per-account
  salt, and the iteration count stored *in the record* so the work factor can be raised later
  without invalidating accounts created before the change.
- **The session is a local flag, not a security boundary.** Anyone with devtools can set it. That
  is stated in `lib/auth.ts` rather than implied away.
- **The swap is contained to one file.** Every function is async and returns the same shapes, so a
  real backend turns `register`/`signIn` into fetches and `loadSession` into a token read, with no
  UI change.

Signing out deliberately keeps the account record, so the sign-in form can pre-fill the address and
greet the learner by name. Progress is a separate key and is never touched by identity operations.

### Marketing claims are measured, not typed

The landing page's central claim — that the most common words cover a large share of everything
written — is computed from the shipped corpus lists by `.workbuddy-ai/coverage.mjs` and read from
`lib/corpus-facts.ts`. Nothing is hand-entered. Where a source publishes ranks and no counts
(Japanese), the page says so instead of showing an invented percentage.

Regenerate after rebuilding any frequency list:

```bash
node .workbuddy-ai/coverage.mjs
```

### One rule about client boundaries

A function exported from a `"use client"` module is a client *reference*, not a function — a server
component that calls it fails the build. So `buttonClasses` lives in `ui/button-classes.ts`, which
carries no directive, rather than in `ui/Button.tsx`. The landing page needs to style a `<Link>` as
a button from the server, and that is the only way to do it without duplicating the recipe.

### The three ideas that hold it together

**1. The queue is a pure function of persisted state.**
`deriveQueue(session)` returns the full ordered list — main pass plus the second-chance pass for
words rated Hard — from nothing but the session record. That is why an offline reload resumes on
the exact card the learner stopped at, and why "Undo" can restore scheduler state rather than just
the UI.

**2. A brand-new word is met, not quizzed.**
The first time a word appears there is nothing to self-assess — you have not had a chance to
forget it yet. So the first exposure ends on a single **Got it** button (plus an optional
"Show me again today"), and the three-button Hard/Good/Easy bar appears from the *second* encounter
onward, when the rating is a genuine recall signal. `firstExposure` in `session/page.tsx` is
`pass === 1 && status === "new"`; a word rated Hard on its first look therefore returns as pass 2
*with* the rating bar, because that second look really is an attempt.

**3. Delight is instrumented, not asserted.**
`src/lib/metrics.ts` records time-to-first-card, pace-per-card, hard-rating share, session
completion, offline sessions and recall accuracy, locally and anonymously. The live numbers are on
**Settings → Delight metrics**. If a change does not move one of them, it is decoration.

---

## The recall drill

The spaced-repetition session asks *"do you recognise this?"*. The drill asks the harder question:
*"can you produce it?"* — recognition and production are different memories, and only one of them
survives a real conversation.

- **Deck selection** (`engine/recall.ts`) ranks known words by a transparent pressure score:
  `difficulty 0.42 + overdue 0.24 + lapses 0.16 + fragility 0.10 + staleness 0.08`. Words never
  met are excluded outright.
- **Each card carries its reason** — *Slipped 3 times*, *Not seen in 11 days*, *You rated this
  hard* — so the drill is explainable rather than arbitrary.
- **A 6-hour cooldown** per word stops the drill becoming a treadmill, with a graceful fallback to
  the wider pool when the cooled set is too thin.
- **Results are real study.** An attempt feeds `applyRating` in the scheduler
  (`remembered → good`, `!remembered → hard`, which schedules a genuine lapse), lands in the
  consistency strip, and rolls up into the recall-accuracy metric. It deliberately does **not**
  touch the streak — a bonus drill must not be able to keep a habit alive on its own.
- **Undo is exact.** `recallUndo` stores the previous `WordProgress`, so `⌘Z` restores the
  scheduler, not just the pixels.

---

## Design language

Derived from the supplied visual references: near-white paper, soft graphite ink, generous
whitespace, rounded floating surfaces, and a single accent colour.

- **Typography** — Figtree for everything; Instrument Serif italic for romanization and the
  occasional editorial line. The word on a card is the largest thing on the screen.
- **The glyph tile** — a rounded square with a soft vertical gradient, the glyph centred and its
  reading beneath. It appears in onboarding, the language picker, the frequency ladder and the app
  icon, which is what makes the product feel like one object.
- **Colour** — strictly monochrome, with one accent (ember) reserved for the streak, milestones
  and the "Hard" rating. Correct/incorrect states never rely on colour alone.
- **Motion** — transform and opacity only. Fast, purposeful, and fully disabled under
  `prefers-reduced-motion` (or the explicit setting in Settings → Motion).

### Spacing & radius scale

Two scales govern every surface in the app. They are documented in full at the top of
`src/app/globals.css`, which is the single source of truth.

**Spacing — a 4px grid with no half steps.** The permitted values are
`4 · 8 · 12 · 16 · 20 · 24 · 28 · 32`.

| Role | Value |
| --- | --- |
| icon ↔ label | 8 |
| label ↔ value | 4 |
| vertical inside a list row | 16 |
| between panels | 12 |
| between sections | 24 |
| card padding — phone / desktop | 20 / 28 |
| page gutter — phone / desktop | 20 / 40 |

Surfaces are padded through named utilities rather than ad-hoc `p-*` classes, so the rhythm cannot
drift: `pad-card` (20), `pad-card-lg` (28), `pad-panel` (20), `pad-row` (16), `pad-sheet` (24
inline).

**Radius — four steps, each with one job, plus pills.**

| Token | Value | Used for |
| --- | --- | --- |
| `rounded-card` | 26px | primary surfaces: today's card, the flashcard, the summary |
| `rounded-panel` | 20px | secondary surfaces: settings groups, stat panels, sheets |
| `rounded-row` | 16px | list rows, inputs, buttons, option tiles |
| `rounded-chip` | 12px | small chips, glyph previews, keyboard keys |
| `rounded-full` | — | pills, avatars, progress bars, dots |

Radius is assigned by **role, not by size** — that is what makes a card read as more important than
the button sitting inside it.

Both scales are verified empirically rather than by eye. `.workbuddy-ai/verify.mjs` walks the
computed style of every painted element on every screen and histograms the result:

- **padding** — `4 · 8 · 12 · 16 · 20 · 24 · 28 · 32` px, plus `112` (`pb-28`, the clearance under
  the fixed mobile nav). Every value is a multiple of 4, and `offGridPadding` is empty on all eight
  audited screens.
- **radius** — exactly `0 / 12 / 16 / 20 / 26 / full`. Nothing else appears.
- **overflow** — `scrollWidth === viewport` on every screen at 390px and at 320px, with zero
  overflowing elements and zero console errors.

---

## The arc navigation

The mobile bar is a **shallow dome**, not a row of icons: its top edge is a parabola that rises 13px
above its two ends, and the five items sit on a line parallel to it, so the outer ones ride lower
than the middle one and the active pill travels *along the curve* when the section changes.

Three details make it work:

- **The silhouette is an SVG path stretched with `preserveAspectRatio="none"`**, inside a container
  that is exactly `VB_H` tall. That makes the vertical scale exactly `1`, which is what lets the
  items be positioned in plain pixels and stay glued to the drawn curve at any width.
- **The shadow is a `drop-shadow` filter, not a `box-shadow`.** A box-shadow would paint a rectangle
  behind a domed shape, visible in the concave corners either side of the apex.
- **The item width is derived from the container**, `min(58, width/count − 4)`. The outermost item's
  centre sits `width/(2·count)` from the bar's end, so a fixed 58px pill overflowed the silhouette at
  320px and overlapped its neighbour by 3.4px — stealing taps from the item next door.

### The active index is controlled, not internal

`ArcNav` holds **no index of its own** — `activeIndex` is a prop. Tapping is only the first of four
ways it changes:

| Path | How |
| --- | --- |
| Tap | `onClick` on the item |
| Keyboard | `ArrowLeft` / `ArrowRight`, handled on the container so it works from any focus ring |
| Swipe | A horizontal drag across the bar, past 44px or 420px/s |
| **The route** | `BottomNav` derives the index from `usePathname()`, so deep links, the back button, a redirect out of a finished session, or any `router.push` anywhere in the app all move the pill |

Because the index lives outside, a coach-mark, a keyboard shortcut or a test can set it directly.
`-1` means "none of these" and hides the indicator rather than parking it on the wrong section —
currently a guard rather than a path the app takes, since `/session` and `/onboarding` are
full-screen and mount no shell at all.

### The grain

Every card carries it — one texture class, applied everywhere, because the alternative was two.
There used to be a second `.speckle` utility (a regular 7px `radial-gradient` dot grid, masked
radially), and it could not coexist with this one: both were defined as `.X::after`, so an element
carrying both classes got a *single* pseudo-element that both rules targeted, merged
property-by-property. Measured on the real page, the grain's `background-image` and
`background-size` won (being later in source) while the speckle's `mask-image` still applied — so the
film grain rendered masked by the halftone's radial fade and the dot grid never appeared at all. Not
"either, or both"; neither, by accident. It also left the app inconsistent: on `/learn` the "Today's
words" card had the dot grid while the adjacent word-chart card had grain.

"Every card" is the rule, and `.surface-card` is not the only way to build one. `rounded-panel` +
`bg-surface` + a hairline is the same visual species, and hand-rolled that way are the two
session-complete stat panels, three onboarding panels, the install-prompt panel and the desktop
rail's "Current list". All of them carry `grain` directly — 14 grained surfaces in total, 7 through
the primitive and 7 by hand. The surface token is what separates a card from a well: `bg-surface` is
the card surface, `bg-paper` is the page, so a `bg-paper` panel is a well nested *inside* a card and
deliberately takes no texture of its own. The harness asserts this rather than trusting it — see the
five `texture:` checks below, two of which exist only to stop the other three passing vacuously.

The texture is an `feTurbulence` noise field as an inline SVG data URI. It is a real noise field, not
a dot grid, so it reads as paper rather than as a printed halftone — and that matches the reference,
which carries a fine uniform grain rather than a mechanical screen. `stitchTiles` keeps the 140px
tile seamless, and the alpha is forced opaque by a `feColorMatrix` matrix: the turbulence's own alpha
varies, and a semi-transparent tile makes every pixel measurement of the field wrong, because
`drawImage` + `getImageData` reads back premultiplied.

The field is **bright-biased** — measured mean 187/255, not the 128 you would assume, because
`fractalNoise` sums four octaves. Left alone, that makes `overlay` and `soft-light` near no-ops on a
near-white card (spread ≤ 0.72 at any opacity), and forces a choice between `multiply` (which works
on paper but is dead in the dark) and `screen` (which works in the dark but lightens it). Both cost
5–7 levels of surface colour.

So the field is **re-centred on mid-grey** with `--grain-filter`, which makes `overlay` — the one
blend that is mean-preserving around the backdrop — usable in both themes:

```css
--grain-filter: brightness(0.68) contrast(1.5);
```

`brightness() contrast()` rather than an SVG `feComponentTransfer`, because CSS filter functions are
evaluated in sRGB while SVG filter primitives default to `linearRGB` — where the same nominal shift
moved the mean by **59 levels** in one setting and **118** in another. The pair is *solved*, not
bisected: CSS applies filter functions left to right, so `brightness(k) contrast(c)` composes as
`x → ckx + (0.5 − 0.5c)`. With the field at mean 0.733 / sd 0.060, holding the mean at 0.5 requires
`k = 0.5/0.733 = 0.68` for any `c`; `c = 1.5` then restores the spread to 0.061.

Centring makes the strength free: with `overlay` on a mid-grey field the surface shift is under 0.2
levels at *any* opacity, so `--grain-opacity` buys texture and nothing else.

The values are chosen against measurements, not by eye. `.workbuddy-ai/grain-sweep.mjs` screenshots
a card interior twice — once normally, once with `.grain::after` hidden — and reports the luminance
spread of each, so the delta is the grain alone with the text underneath held constant:

| | spread (sd) | distinct levels | surface shift |
| --- | --- | --- | --- |
| flat card (grain off) | 0.00 | 1 | — |
| **as shipped, light** (`overlay` 1.0) | **1.79** | 13 | −0.19 |
| **as shipped, dark** (`overlay` 0.58) | **1.69** | 12 | −0.14 |
| uncentred field, `multiply`/`screen` | 1.68 / 1.75 | 11 | −5.2 / +6.6 |
| the first version (`soft-light` 0.32) | 0.48 | 2 | +0.4 |

The last row is the point of the exercise: it looked fine in a screenshot and measured at 0.48 levels
of spread against a flat surface — nominally present and visually absent. "A little" still has to be
*some*. The third row is why the field is centred rather than blended around: same texture, and the
surface colour is left alone.

---

## PWA

- `public/manifest.webmanifest` — installable, with shortcuts to Today / Review / Progress
- `public/sw.js` — hand-rolled: network-first navigations with a cached fallback,
  stale-while-revalidate for content-hashed assets, cache-first for icons
- `public/icons/` — generated by `scripts/make_icons.py` (Pillow + a Devanagari face)
- Install prompt is deferred until **after the first completed session**, and never shown twice

---

## Seed data and the corpus

Ten languages, each with a **3,000-entry frequency list counted from a real corpus**, and ~250
curated teaching entries (native script, reading, romanization, IPA-style pronunciation hint, part
of speech, corpus rank and, where written, an example sentence). Japanese ships the deepest set (50
words) and includes Nepali and Hindi glosses for the first twelve, to prove that `nativeLanguage`
genuinely drives what the learner reads.

**No rank is ever authored.** A word that cannot be placed in the corpus is dropped rather than
given a plausible-looking number, which is why the lists contain gaps — there is no teachable word
at Japanese rank 9, 16 or 22.

| Languages | Source | Licence |
|---|---|---|
| `ko zh es fr de hi ar ru` | [`hermitdave/FrequencyWords`](https://github.com/hermitdave/FrequencyWords) 2018, derived from OpenSubtitles | CC BY-SA 4.0 |
| `ja` | [`wordfreq` 3.x](https://github.com/rspeer/wordfreq), word-level normalisation | see repository |
| `ne` | [`Someman/news_nepali`](https://huggingface.co/datasets/Someman/news_nepali) (Hugging Face), counted directly from the corpus | see dataset card |

Japanese does not use FrequencyWords because its Japanese file is morpheme-level — `する` and `私`
are absent from all 50,000 entries, so it cannot rank the words this app teaches. Nepali is absent
from FrequencyWords entirely, so its list was counted from a news corpus instead.

Every source, URL, licence, distinct-token count and token total is recorded in the generated file
headers **and** in `FREQUENCY_META` (`src/lib/data/frequency/manifest.ts`, itself emitted by the
build script rather than kept by hand), and surfaced in the app: the Progress screen links the
source and prints the *measured* share of the corpus the first hundred words cover — 25% for
Korean, 57% for Hindi, and for Japanese the screen says nothing numeric, because a rank-only
source publishes no counts to compute one from.

`frequencyListSize` is derived from `FREQUENCY_META`, never hand-written — a hand-kept copy drifted
to `2000` for Nepali against a real list of 3,000.

**Word ids are positional** (`ja-19` is "the 19th most frequent Japanese word"), so re-ranking
against a real corpus invalidated every saved id. `STATE_VERSION = 2` drops the positional records
(`progress`, `sessions`, `recallLog`) on migration while preserving settings, streak, onboarding
date and celebrated milestones — carrying them forward would have credited a returning learner with
words they never met.

Adding a language: add an entry to `LANGUAGES` in `src/lib/languages.ts`, a dataset file in
`src/lib/data/`, a gloss set in the build pipeline, and a row to the table above. Nothing else
changes.

---

## Verification

`.workbuddy-ai/verify.mjs` is a Playwright harness that seeds a realistic `AppState` into
`localStorage` and then drives the real app in headless Chromium. It runs thirteen passes:

1. **Every screen, light** — onboarding, learn, recall, review, progress, settings — then the
   onboarding *wizard walked step by step*, because a plain route visit only ever sees step 1 and the
   three panels that carry the texture live on steps 4 and 5. That gap is precisely how those panels
   shipped matte while every check passed, so the probe now runs at each step.
2. **Session complete** — the only card-bearing surface no other pass reaches, because it mounts only
   once the queue is empty. The queue is driven to the end: the loop takes the rating bar *first* and
   answers only if there is nothing to rate, since `reveal`, `choice` and `type` all end at the same
   bar and the loop then never needs to know which mode it is looking at. `cardsAnswered: 50` for a
   25-card deck — two iterations per card — and the bound is 4× the goal for that reason: the first
   attempt capped at 40, which is less than 2 × 25, and stalled at card 20 of 25 without failing.
   The two stat panels are then asserted present (`["VOCABULARY", "STREAK"]`), equal height, and
   unclipped.
3. **Dark theme** — every screen plus the session card back. Seeded with French rather than
   Japanese, because Japanese's source is rank-only and its card carries no corpus caption, so a
   dark pass on it would silently skip the line being themed.
4. **Reduced motion** — asserts nothing is still animating.
5. **320px viewport** — asserts no overflow and that the nav still fits, on learn, recall and
   settings, plus the session card back (the one screen the loop does not otherwise reach, and the
   tallest card in the app).
6. **The two flashcard branches**, as an A/B pair: a word the learner has never met must show
   *no* rating bar (only "Got it"), and a word they have already met must show all three
   (Hard / Good / Easy). This is what keeps the first-exposure change from silently regressing.
7. **Recall edge cases** — the empty state (nothing known yet must explain itself and point at
   Today's words, not render a blank card), a brand-new install with no stored state (must land on
   onboarding rather than crash), and the "Another N words" loop (must start a genuinely different
   deck, not replay the same one).
8. **The bottom sheet's entrance**, as a *position trace* rather than a screenshot: the panel's top
   edge is sampled every frame from the moment it mounts, so the report is
   `startTransform: matrix(1,0,0,1,0,599.625)` at insertion, `startTop === viewportH` (it begins
   exactly at the fold, i.e. entirely off-screen), `travelled === height === 600`, `overshootTop:
   false`, `backtrackPx: 0`, `settleMs ≈ 500`. The same pass drives drag-to-dismiss (past 96px must
   dismiss; a 24px pull must survive).
9. **Reduced motion** — the sheet must appear in place (`travelled: 0`), not travel.
10. **Desktop** — a dialog that fades in place, not a panel rising from the floor of a monitor.
11. **The corpus, per language** — one context per language, reading the rendered Progress screen to
    assert the list size label, the sample words (in that language's own script), the coverage
    percentage, and the provenance link and licence. Japanese must report *no* percentage, because
    its source publishes no counts. Arabic's chips must carry `dir="rtl"`. This pass also carries the
    desktop-rail texture probe, since the rail is `hidden … lg:flex` *and* only exists on screens
    that mount the shell — `/session` is full-screen and has no rail at all, so probing it there
    reported a rail with zero cards and read as a pass.
12. **The arc nav, the four input paths, and the word chart.** The bar is probed geometrically
    rather than judged from a screenshot: `arcRisePx: 8` with `itemTops: [773, 767, 765, 767, 773]`
    is what "the items ride an arc" means, and the indicator's centre is compared against every
    item's centre to find which one it covers. All four paths are driven end to end — tap →
    `/review` index 2, `ArrowRight` → `/progress` index 3, swipe → `/settings` index 4, then a deep
    link to `/settings` index 4 and the back button → `/progress` index 3 — and each must report
    `indicatorOnIndex === activeIndex`. The chart's 20 tiles are read from their own
    `data-chart-rank` / `data-chart-pos` annotations to assert the ranks ascend from 1 and that the
    set is not verb-dominated.
13. **The texture sweep** — run at every screen, every wizard step and on the completion screen.
    Two invariants, both of which have caught a real miss: every `.surface-card` carries the grain,
    and every *hand-rolled* card does too (`rounded-panel`/`rounded-card` + the `bg-surface` card
    token + a border). Two further checks guard against a vacuous pass — one asserts the selector
    still matches something at all, the other that the desktop rail's card specifically was reached.

The run ends with a self-judging `checks` block rather than leaving 20KB of JSON to be read by eye,
so a regression in any claim fails loudly:

```
PASS  arc: middle item is higher than the outer ones
PASS  active: indicator covers the active index
PASS  active: route drives the index (deep link + back)
PASS  active: tap/keyboard/swipe reach the right section
PASS  fit: no overlap, no overflow at any width
PASS  fit: touch targets stay >= 44px
PASS  words: chart is in ascending corpus rank from rank 1
PASS  words: chart is not verb-dominated
PASS  texture: every surface-card carries the grain
PASS  texture: no element carries two texture classes
PASS  texture: every hand-rolled card carries the grain
PASS  texture: the hand-rolled-card selector still matches something
PASS  texture: the desktop rail's card is probed, not skipped
PASS  session complete: both stat panels present and unclipped

ALL CHECKS PASSED  ·  console/page errors: 0
```

The fit check covers 390px *and* 320px, because 320px is where the pills stopped fitting. Two
smaller harness bugs were fixed alongside it: the 320px pass was measuring
`nav[aria-label='Primary'] > div`, which matches the desktop `SideNav` first, and the programmatic
probe read `page.url()` while building its report — i.e. *after* `goBack()` — so it labelled the
deep-link row with the post-back URL.

`.workbuddy-ai/shot-nav.mjs` and `.workbuddy-ai/nav-measure.mjs` are the two focused tools for the
bar: the first captures 3× crops of it alone (a 13px dome is three pixels at 1×, where a correct arc
and a flat bar look identical), the second samples the drawn path with `getPointAtLength` to prove
the dome is symmetric — it reports `symmetryDelta: 0.081` viewBox units between the quarter points,
and it is what disproved a suspected off-centre apex.

Five more focused tools cover claims the main harness only asserts indirectly:

- `.workbuddy-ai/grain-sweep.mjs` — the opacity × blend curve for the grain, measured as luminance
  spread. This is what showed that `soft-light`/`overlay` are near no-ops on a near-white card and
  that the field is bright-biased, which is why the light and dark themes use different blends.
- `.workbuddy-ai/grain-final.mjs` — the same measurement against the *shipped* tokens, so the
  reported number is the one the app actually serves.
- `.workbuddy-ai/chart-audit.mjs` — the word chart at 320px in French, German, Arabic, Hindi and
  Japanese, checking each tile's word against its own `scrollWidth` so a long word is caught rather
  than silently clipped. All five: 20 tiles, 5 rows of 4, `clipped: []`, `wrapped: []`, no card or
  page overflow.
- `.workbuddy-ai/card-audit.mjs` — enumerates every card-radius surface on every route *and* every
  step of the onboarding wizard, labels each one by the surface token it actually computes to
  (`surface` = a card, `paper` = a well nested inside one) and reports which lack the grain. This is
  the tool that found two of the three onboarding panels still matte after the harness had gone
  green, and it is worth keeping separate from the harness precisely because it looks in states the
  harness does not drive.
- `.workbuddy-ai/shot-cards.mjs` — 3× crops of each card-token panel, for the same reason
  `shot-nav.mjs` crops the arc bar: a 1.8-level luminance spread is invisible in a downscaled
  full-page screenshot. Covers the onboarding panels and both completion panels.

It also walks the computed style of every painted element to histogram padding and radius, and
asserts zero horizontal overflow — the audit is what caught the two off-scale values
(`rounded-[3px]`, `gap-[3px]`) that a regex migration could not see, and later the 6px chip padding
introduced with the "Next in the list" panel.

Timing note: the card reveal is a 320ms `AnimatePresence` swap. Harness waits must be *greater*
than that, not equal to it — waiting exactly 320ms intermittently reads the DOM mid-mount.

Two harness lessons worth keeping, because both produced failures that looked like product bugs:

- **`requestAnimationFrame` cannot observe frame 0.** Asserting "the first sample is still below the
  fold" is unsatisfiable — a spring is already ~30px along by then, so a correct implementation
  fails. The start position has to come from a `MutationObserver` armed before the click, which
  runs before the next paint.
- **`innerText` returns text after `text-transform`.** Labels styled `uppercase` read as
  `NEXT IN THE LIST`, so a case-sensitive match returns `null` and looks like a missing element.

---

## Companion document

`../ux-delight-strategy.html` — the interaction analysis this implementation is built from:
28 improvements across onboarding, core workflow, feedback and error states, each with its target
interaction, intended emotional impact, success metric and priority.
