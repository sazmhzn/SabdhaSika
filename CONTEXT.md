# SabdhaSika

SabdhaSika teaches the most frequent words of a language first, in rank order. This glossary fixes the words the product uses to talk about learning itself, so that code, user-facing copy and metrics all mean the same thing by them.

## Language and the word

**Learning language**:
The language whose words are being taught. Exactly one at a time, set in onboarding. Code: `targetLanguage`.
_Avoid_: target, foreign language, L2, source language

**Meaning language**:
The language a word's gloss is written in. A role of the *definition*, not a property of the learner — the learner does not "have" a native language here. Code: `nativeLanguage`.
_Avoid_: native language, translation language, user language

**Word**:
The teachable unit: one entry in the syllabus with a written form, a meaning, and a frequency rank.
_Avoid_: card, item, entry, term, vocabulary item

**Card**:
A word as presented once during a session, with a pass and a rating. The same word becomes a new card on each pass.
_Avoid_: flashcard, item, question

**Frequency rank**:
Position in the corpus list, where 1 is the most frequent word. Mutable: an upstream rerank moves a word's rank without changing its identity, and gaps are preserved rather than closed up. Cards are ordered by it.
_Avoid_: index, position, order, index number

**Word id**:
A stable, opaque identity for a word, independent of its frequency rank. Survives any rebuild or rerank of the list.
_Avoid_: rank id, positional id, slug, key

## The data

**Corpus list**:
The ranked rows of one language as published by a frequency source, with occurrence counts where that source provides them. Never taught directly; it is the ordering every word derives from.
_Avoid_: frequency list, word list, dataset, corpus

**Syllabus**:
The ordered, teachable subset of the corpus list: every corpus row that resolved to a meaning. Deliberately sparse — ranks keep their gaps, so a syllabus "rank" is always the corpus rank and never a renumbering. Some languages ship fewer than the corpus list holds.
_Avoid_: course, curriculum, word list, deck

**Unresolved word**:
A corpus row that no source could give a meaning. It is not a word: it stays a corpus row, is never taught, and never occupies a place in a session or the syllabus.
_Avoid_: missing word, empty word, skipped word

## Provenance

**Source**:
An origin for ingested data — a name, a URL and a licence — attached to a corpus list, a meaning, a reading, an example or an audio recording.
_Avoid_: provider, feed, dataset, vendor

**Attribution**:
The learner-facing rendering of sources and their licences, reachable from Settings. Required, not decorative: the ingested data is share-alike.
_Avoid_: credits, licence notice, legal page

## Progress

**Untouched**:
A word never met. Code: `status === "new"`.
_Avoid_: unseen, new (as a user-facing word)

**Met**:
A word the learner has answered at least once, in either direction. The counter the UI calls "Words met".
_Avoid_: learned, seen, touched, studied

**Mastered**:
A met word that is holding: high ease and low difficulty. A strict subset of Met.
_Avoid_: learned, known, done, complete

**Recall**:
The production direction of meeting a word — the meaning is shown and the learner produces the word. Advances the same progress as a session, but never completes a day and never advances the streak.
_Avoid_: test, quiz, drill, reverse review

**Milestone**:
A count of words met, at one of 100 / 250 / 500 / 1000 / 2000 / 3000. Counts words, not ranks — with a sparse syllabus, "100 words" means a hundred learned, never "the top hundred".
_Avoid_: checkpoint, level, badge, rank reached

The scheduler's `learning` and `familiar` bands are internal thresholds of the algorithm, not domain terms, and must never be shown to the learner as stages.

## The day

**Session**:
One day's study run, keyed by date, and the only thing called a session. Persisted in `AppState.sessions`.
_Avoid_: lesson, run, study session, daily session (redundant)

**Queue**:
The ordered cards of a session, worked through to the end. Deferrals are pushed to the back.
_Avoid_: deck, list, stack

**Deck**:
A selection of words drawn for one exercise, order-agnostic and capped in size. Only Recall has one.
_Avoid_: queue, list, set

**Pass**:
Which sighting of a word within a session this is. Pass 1 is the first, pass 2 is the second chance given to a word rated hard on pass 1.
_Avoid_: round, attempt, rep

**First look**:
A word met for the first time ever. It is presented as a lesson, not a test: no rating bar, only "Got it".
_Avoid_: first exposure, new card

**Defer**:
Pushing a card to the back of today's queue without rating it. Surface copy: "Show me again today".
_Avoid_: skip, snooze, postpone, later

**Day done**:
The day's queue is empty. The only state that advances the streak; nothing else — not recall, not partial progress — can complete a day.
_Avoid_: session complete, finished, done for today

**Streak**:
Consecutive days done, counted in days, with one grace day of forgiveness.
_Avoid_: run, chain, record

**Grace day**:
A single missed day that does not break the streak: a gap of exactly two days still advances it. Two missed days break it.
_Avoid_: skip day, freeze, rest day, streak save

## Review and attention

**Review**:
Meeting a word again after it has been met — the second and later passes, as opposed to the first look. Not a place and not a mode of input.
_Avoid_: revision, repetition, re-study

**Attention queue**:
The set of met words currently needing attention, shown on the Review tab: due today, difficult, slipped away, just learned. Built from buckets; not the same set as words rated today.
_Avoid_: review list, review queue, backlog

**Practice run**:
An ad-hoc run started from the attention queue. Never persisted, never completes a day. Surface copy: "Practise just these".
_Avoid_: review session, review run, focused session

## Identity

**Account**:
A device-local identity that can hold a display name and sign in. It owns no learning data: progress, streak and history are separate and survive every identity operation.
_Avoid_: user, profile, login

**Sign-in**:
The local flag recording that an account is active on this device. A convenience, not a security boundary.
_Avoid_: session, auth session, auth token, login session
