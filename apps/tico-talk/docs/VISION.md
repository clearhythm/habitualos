# Project Vision — Tico

## One-Line Pitch

Rehearsal, not lessons. An AI coach that runs realistic shift scenarios in
Spanish so bilingual-track restaurant staff walk into work **confident** —
not "fluent on paper" — starting with the Host role.

## The Problem

Language learning apps optimize for vocabulary, grammar, streaks, and levels.
None of that reliably transfers to the moment a couple walks in and you
freeze. There's a gap between conversational language study and workplace
readiness — and workplace readiness is what actually matters to the user and
to their employer.

## The Core Insight

**Confidence, not fluency, is the target.** The user isn't trying to become
generally fluent in Spanish — they're trying to sound **natural and
professionally competent** within a specific, fairly contained job function.
"Natural" is the honest word for this: not textbook-correct, not
code-switched-native, but smooth, human, and appropriate to the context.

A second insight makes this product uniquely possible now: **an AI with
audio input can assess things a text-based app never could** — timing,
hesitation, delivery, whether an interaction *felt* natural — not just
whether the words were structurally correct. Structural correctness and
"contextually natural" are different bars, and this product is built to
train and assess against the second one.

## Target User (MVP)

Restaurant **Host** staff at a Northern California Mexican restaurant
(Margaritaville) who have some Spanish but lack confidence using it on shift.
Bilingual capability is a path to upward mobility on the job (becoming the
person who can serve Spanish-speaking guests), which is real, personal
motivation — not an abstract "learn a language" goal.

**Target register:** formal, professional **Mexican Spanish** (usted-based,
standard professional vocabulary, no regional slang or Peninsular forms like
*vosotros*). This isn't "neutral Latin American Spanish" — it should match
what the kitchen staff and clientele actually speak, because that's what
reads as respectful and competent, not textbook-foreign.

## Core Experience

The user presses **"Prepare for Shift."** The AI opens a roleplay: a
randomly generated Spanish-speaking guest (or party) approaches with variable
party size and preferences. The scenario moves through the natural sequence
of a real interaction — greet, ask party size, seating preference, seat and
present menu, hand off to server, water service — mirroring how the
conversation actually unfolds on shift.

Within the scenario, progress happens **beat by beat** (see Design.md for the
full mechanic), not as one long roleplay followed by a single feedback dump
at the end. Each beat gets a cold attempt, an assessment, and — only if
needed — brief coaching and a couple of drill reps before moving on.

After 2-3 scenarios (~10 minutes), the session ends.

## Daily Loop

- **Before work (~10 min):** Prepare for Shift — practice session as above.
- **During work:** no app interaction. The user just works the shift.
- **After work (optional):** a quick voice reflection — "I struggled
  explaining the wait time," "I forgot how to offer water." For MVP, these
  reflections are captured but not automatically used to change the
  curriculum — see Non-Goals.

## Progression Model: The Confidence Bar

Each node in a role's skill tree carries its own tier, not a single overall
percentage:

**Training → Capable → Natural → Mastered**

- Tiers advance **immediately** on a strong cold (first, unprompted)
  attempt — no multi-session confirmation required. The AI is treated as a
  reliable judge of naturalness from a short utterance, provided its
  assessment rubric is explicit and consistent (see Design.md).
- Practice reps taken *after* coaching do not count toward advancement —
  only fresh, cold attempts are assessed. This keeps the bar honest: parroting
  a phrase you were just given isn't the same as producing it unprompted.
- **Decay is real.** If a previously-mastered node's cold check comes back
  weak, it demotes and re-enters the full feedback loop until re-earned. The
  confidence bar reflects current standing, not a permanent achievement.
- This lets a user of *any* starting level use the same app: a beginner
  slow-walks through node one across many sessions; someone already capable
  breezes through mastered nodes with a quick pulse-check and only really
  engages at their actual frontier.

This is the thing a user could show a manager: not "completed Lesson 8," but
"Natural at greeting and seating, Capable at water service" — a real,
legible skill profile.

## Phrasing Philosophy: Concepts Are Canonical, Phrasing Is Generative

There is no single "correct" canonical sentence per skill node — there are
canonical **concepts** (e.g., for "ask seating preference": inside/outside,
high-top/low-top, sun/shade). The AI generates natural target phrasing live,
grounded in those concepts, rather than pulling from a fixed phrasebook. This
gives the user 2-3 different natural ways to express the same functional
need — which keeps a practicing speaker engaged — rather than training them
to parrot one canonical line. Generated phrases are logged for future
curation, but MVP does not require a hand-built phrase bank.

## MVP Scope

**One role: Host.** The canonical Host skill tree for this MVP:

1. Greet & welcome
2. Ask party size
3. Ask seating preference (inside/outside, high-top/low-top, sun/shade)
4. Accommodations (e.g., high chair)
5. Seat guests & present menu (including specials)
6. Server hand-off ("your server will be right with you")
7. Water service (ice/no ice, delivery)

This tree is treated as fixed and hand-authored for MVP — see Non-Goals.

## Non-Goals (MVP)

- **No automated curriculum adaptation.** Post-shift voice reflections are
  captured, but incorporating them into the skill tree or scenario content is
  a manual, human-in-the-loop process (a future Claude Code session), not a
  live feature.
- **No automatic canon expansion.** If feedback surfaces a realistic gap
  (e.g., "I didn't know how to explain a wait"), adding that to the tree is a
  deliberate authoring decision, not something the app does on its own.
- **No per-restaurant menu customization.** Menu-specific Q&A becomes
  relevant at the Server tier, not Host. Build with an eye toward this
  extensibility later, but do not build it now.
- **No gamification** in the Duolingo sense — no streaks, points, or
  badges. Progression is expressed entirely through the confidence bar and
  tier language.
- **No full-duplex/interruptible voice** for MVP. Push-to-talk is the
  right fidelity for Host-level scenarios (see Design.md); realtime,
  interruptible conversation is a later difficulty lever, not an MVP
  requirement.

## Roadmap (Post-MVP)

- **Additional roles:** Expo → Server → Bartender → restaurant management.
- **Per-client customization:** restaurant-specific menu ingestion (image
  upload + OCR) becomes relevant starting at Server, where guests actually
  ask food/drink-specific questions. This is the path from "personal tool"
  to **a training product an ownership group could adopt or require** —
  potentially sold as seat-based access.
- **Language-agnostic version:** the same confidence-coaching mechanic
  (cold assessment → tiered mastery → decay/retrain) could train
  English-speaking new hires in guest-service skills generally, addressing
  restaurant industry turnover and onboarding — a different but related
  business, not required for or blocking the Spanish-focused MVP.
- **Difficulty tiers beyond Host:** interruption, background noise,
  accented/regional speech, and reduced pause tolerance as levers for roles
  where real conversational chaos (not prescribed exchanges) becomes part of
  the skill being trained.

## Guiding Principle

Everything should answer one question: **will this make the user more
confident during their next real shift?** If yes, it belongs. If not, it
probably doesn't.

## Notes

- **Working name:** "Tico" (previously "Hip Taco," before that "Ready
  Set," which felt too stiff/corporate). "Hip Taco" was chosen because
  the name works on three levels: (1) "hip taco" reads as "hip talk" —
  getting hip to, and fluent in, the workplace interaction; (2) it's
  grounded in the literal restaurant/taco context; (3) it's a gentle,
  self-aware nod to the classic English-speaker habit of tacking an "o"
  onto English words to make them sound Spanish — exactly the kind of
  well-meaning fumble the target user is trying to grow past. Checked
  for conflicts: a small California catering business ("Hip Taco
  Catering") uses a similar name but is a different market and not
  trademark-aggressive — low risk for a personal MVP, revisit if this
  ever scales into a wider B2B product. Shortened to "Tico" for the
  actual product/app name — more succinct and memorable, and reads as a
  blend of "talk" + "confidence." The taco mascot/visual identity and
  wordplay carry over from "Hip Taco."
- **Mascot concept:** a friendly talking taco as the in-app coach/tutor
  character — literally embodies the "hip taco"/"Tico" wordplay and gives the
  coaching voice a warm, approachable personality rather than a generic
  AI assistant feel. Visual/personality design is a later step, not
  blocking MVP build.

