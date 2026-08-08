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

**Update:** the target user set is now explicitly multi-restaurant — Erik
himself is the primary near-term user, working across both Margaritaville
and Pete's (a different clientele mix, see "Sequencing Pivot" below). The
underlying "path to workplace confidence" motivation is unchanged; the
app just can no longer assume one restaurant's menu/staff/clientele.

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
legible skill profile. **Update below:** this profile is real and still
tracked, but is no longer shown directly to the person it describes — see
"Staff-Facing Experience."

## Staff-Facing Experience: Coworker, Not Evaluator

A key refinement, reached through building and discussing an actual practice
screen: the tier model above is real and still tracked, but *showing it to
the person being tracked* backfires. It reads as grading existing job
competence rather than practicing something still being learned, which kills
the low-stakes, game-like feeling the product depends on. (This surfaced
concretely: a Spanish-language prototype of this idea genuinely felt fun and
low-stakes to try; the identical mechanic, imagined in English, started to
feel like corporate compliance training. The cause wasn't the language, it
was visible grading.)

What changes for the staff-facing experience specifically:

- **Tico behaves like an experienced coworker, not a teacher** — occasional
  observational tips (not after every turn), never a delivered score or
  correction.
- **Visible progress is a lived-experience tally** ("12 guests welcomed,"
  "3rd shift") — not a bar, not a percentage. The tier/mastery model above
  still exists and still runs, invisibly, deciding which scenarios get
  served (harder/rarer guest types as skill grows) — it's just never
  displayed to the user as a grade.
- **Content is meant to come from combining three axes** — situation (date
  night, family, business lunch, rainstorm...) × guest personality
  (nervous, chatty, celebrating...) × restaurant state (packed, waitlist,
  kitchen behind...) — rather than authoring an exhaustive scripted
  curriculum. Not yet built as dynamic logic (no backend exists to combine
  these live) — documented here as the intended direction.
- **Sessions are framed as "starting a shift,"** not choosing a scenario
  from a list — a roguelike "you don't pick, you handle what comes"
  framing, explicitly *without* any permadeath/failure-ends-the-run
  mechanic.
- **Any tip Tico shares must be real, verified hospitality knowledge** —
  never AI-invented pseudo-psychology presented as fact. This is a hard
  content constraint, not a style preference.
- **The tier model isn't wrong, it's repositioned** — it's the seed for a
  future **manager/GM-facing view** (aggregate team competency, not a
  personal report card), not something the practicing staff member sees
  directly. Not yet built as screens. **Update:** this is now in active
  planning as Ticket 7 (see `apps/tico-talk/plans/`) — a rough
  competency-tree view for a demo to Margaritaville's and Pete's GMs,
  intentionally light (single hardcoded employee, no real auth/identity
  system yet, no real shift-scheduling integration) rather than a full
  build of what's described here. See the sequencing pivot below for why
  this moved up sooner than the roadmap originally implied.

The "No gamification" non-goal below is narrower than it reads in light of
this: no streaks/points/badges in the Duolingo sense, but a lived-experience
tally and unlockable variety are part of the design, not excluded by it.

## Phrasing Philosophy: Concepts Are Canonical, Phrasing Is Generative

There is no single "correct" canonical sentence per skill node — there are
canonical **concepts** (e.g., for "ask seating preference": inside/outside,
high-top/low-top, sun/shade). The AI generates natural target phrasing live,
grounded in those concepts, rather than pulling from a fixed phrasebook. This
gives the user 2-3 different natural ways to express the same functional
need — which keeps a practicing speaker engaged — rather than training them
to parrot one canonical line. Generated phrases are logged for future
curation, but MVP does not require a hand-built phrase bank.

## Sequencing Pivot: Menu-First, Multi-Restaurant (Update)

Written after MVP build had already started on the Host/Spanish/voice
path described below — capturing a real, deliberate change of sequence,
not a replacement of the vision. Two things drove it:

1. **Erik's own situation changed.** He's now working at Pete's more or
   less full-time, alongside Margaritaville. The app needs to actually
   work across both restaurants: pick one, drill its content, track
   progress separately per restaurant. That's not optional polish, it's
   what makes the app usable for his own daily work right now.
2. **Live-testing the Host/voice prototype, and separately thinking
   through what staff actually need, surfaced that "menu-specific Q&A,
   deferred to Server tier" (see the original Non-Goal below) was
   actually the most immediately valuable, buildable thing** — a
   text-based knowledge drill, not voice, not Spanish-specific.

This reframed the skill tree itself. Instead of one role's fixed node
sequence (Host: greet → party size → seating → ... below), the model
became **six knowledge-and-judgment competencies**, applicable across
roles rather than siloed to one:

- **Menu** — ingredient/dietary/pricing recall. This is the thing
  actually being built with real depth right now (see
  `apps/tico-talk/plans/tico-learn-ticket*.md`).
- **Off-Menu** — questions not on the printed menu but real guests ask.
- **Recommendations** and **Upselling** — split into two, not one
  "presentation quality" bucket, see the rubric note below.
- **Complaints** — handling problems, including interpersonal conflict.
- **Languages** — restaurant-specific (which languages, and in what
  ratio, depends on that restaurant's actual clientele — Margaritaville
  skews Spanish, Pete's is more Chinese/Spanish mixed), not a single
  fixed Spanish-only module.

The original Host tree (below) and its Spanish-specific voice mechanic
(Design.md) are **not abandoned** — they're the natural home for
Recommendations/Upselling/Complaints/Languages once those move past a
light prompt-layer proof of concept into the same kind of real-delivery
practice Host was designed for. Text (recall, "Capable") and voice
(delivery, "Natural"/"Mastered") are turning out to be two *stages* of
the same competency, not two separate products.

**Procedural/mechanical skills are explicitly out of scope for now.**
Several of the original Host tree's nodes (seating logistics, water
service, hand-off mechanics) are "how you physically move through a
shift," not knowledge or judgment — decided to drop that distinction
from the six competencies rather than force a fit. If procedural
training belongs here later, it's a separate, lighter bucket, not folded
into the six.

**Assessment rubric grounding, for Recommendations/Upselling
specifically**: the Section 4 rubric below (naturalness, register,
delivery, comprehensibility) is about Spanish phrase production. For
Recommendations/Upselling, a different, evidence-grounded split applies
— DINESERV's **assurance** (trustworthy knowledge, a universal
baseline: is the recommendation actually accurate?) and **empathy**
(reading the guest's actual state and calibrating — relational vs.
transactional — rather than one blended "presentation quality" score).
Considered and rejected Wansink's descriptive-menu-label research as a
grounding source — real research misconduct and retractions there, not
just contested findings.

## MVP Scope

**Near-term build priority: Menu, multi-restaurant, text-based** (see
the pivot above) — not Host/Spanish/voice, which is sequenced after.
Both remain real parts of the product.

**Original MVP framing, still the long-term voice/Host direction — one
role: Host.** The canonical Host skill tree:

1. Greet & welcome
2. Ask party size
3. Ask seating preference (inside/outside, high-top/low-top, sun/shade)
4. Accommodations (e.g., high chair)
5. Seat guests & present menu (including specials)
6. Water service (ice/no ice, delivery)
7. Server hand-off ("your server will be right with you")

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
  extensibility later, but do not build it now. **Update: reversed.** See
  "Sequencing Pivot" above — per-restaurant menu data (and per-restaurant
  everything else: notes, clientele profile, progress) is now the actual
  near-term build, not deferred. This wasn't an oversight, real
  circumstances (Erik working at a second restaurant) changed what was
  most valuable to build first.
- **No gamification** in the Duolingo sense — no streaks, points, or
  badges. Progression is expressed entirely through the confidence bar and
  tier language. **Update:** see "Staff-Facing Experience" above — the
  tier language is no longer user-visible; a lived-experience tally and
  unlockable variety replace it and aren't excluded by this non-goal.
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
  potentially sold as seat-based access. **Update:** this arrived far
  earlier than planned, not at "Server tier" but as the actual near-term
  build (see "Sequencing Pivot") — real menu data now lives in Firestore
  per restaurant, not ingested via OCR yet, but the multi-restaurant
  shape this bullet anticipated is exactly what's being built. A rough
  management/GM-facing competency view (Ticket 7) is the first concrete
  step toward "a training product an ownership group could adopt."
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

## Data Principle (Menu-Era Addition)

Established while first extracting Margaritaville's menu into structured
data, now extended to every restaurant added: menu data (and restaurant
notes, clientele profiles, anything factual about a specific restaurant)
is real, sourced, confirmed information — scanned/typed from the actual
menu, or a real correction from someone who actually works there. It
should never contain AI-interpreted content (a synthesized flavor
description, an inferred pairing, a plausible-sounding placeholder for
data that hasn't been supplied yet). If a restaurant's clientele profile
or complaint policy isn't populated, the app should say so honestly
rather than invent something reasonable-sounding — same principle,
applied everywhere this kind of data shows up now, not just the menu.

## Open Questions (Not Yet Decided)

Carried forward from planning, not yet resolved, worth revisiting rather
than losing:

- Whether cross-restaurant progress-sharing (someone who's mastered a
  skill's *technique* at one property shouldn't have to redo it at
  another) becomes real, and when — blocked on a real identity/auth
  system that doesn't exist yet, itself a substantial separate project.
- Whether procedural/mechanical skills (dropped from the six
  competencies, see "Sequencing Pivot") get a lightweight home later, or
  stay permanently out of scope.
- **Off-Menu content sourcing**: no obvious source of truth the way the
  printed menu has one. Planned approach: an LLM generates a "probable
  questions" canon, validated in the field against real kitchen/server
  knowledge, then structured into real content — a workflow to run, not
  yet something the app's UI needs to support directly.
- **Daily specials**: a commute-time review-and-drill feature from a
  snapshot of the day's specials sheet — ephemeral, snackable, no
  coverage tracking needed. Deliberately kept separate from the six
  competencies' architecture, a real idea, not yet built.
- What the management/competency-overview demo (Ticket 7) actually needs
  to show, informed by separate conversations with Margaritaville's and
  Pete's GMs — deferred until closer to that build step.

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

