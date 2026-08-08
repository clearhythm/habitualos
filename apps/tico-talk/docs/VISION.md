# Project Vision — Tico

## One-Line Pitch

Rehearsal, not lessons. An AI coach that trains restaurant staff on the
practical knowledge and judgment their job actually requires — starting
with menu knowledge, expanding to off-menu questions, recommendations,
upselling, complaints, and service in a second language — so staff walk
into a shift **confident**, not just tested. Delivery under real
pressure (spoken, in the moment, in the guest's language) is the
long-term target for every one of these; the current build starts with
text-based knowledge and judgment, per restaurant.

## The Problem

Language- and knowledge-training apps optimize for content coverage,
streaks, and levels. None of that reliably transfers to the moment a
guest asks something you don't know, or a couple who only speaks
Spanish walks in and you freeze. There's a gap between studying material
and workplace readiness — and workplace readiness is what actually
matters to the user and to their employer.

## The Core Insight

**Confidence, not raw recall, is the target.** The user isn't trying to
pass a quiz — they're trying to sound and act like someone who actually
knows the job, in the moment, under mild real-time pressure. That's a
different bar than "got the answer right," and the product trains and
assesses against the harder bar.

A second insight shapes the long-term architecture: **an AI with audio
input can assess things a text-based app never could** — timing,
hesitation, delivery, whether an interaction *felt* natural, not just
whether the content was correct. This is why the four judgment-and-
delivery competencies (Recommendations, Upselling, Complaints,
Languages) are designed around two stages — text-drill first, then
voice practice — see "Two Competency Shapes" below. Menu and Off-Menu,
being pure-recall knowledge competencies, don't need this second stage.
The current build lives entirely in text, across all six.

## Target User (Current)

Restaurant staff working across multiple properties with different
menus, clientele, and policies. Erik is the primary near-term user,
working across two real restaurants at once — **Margaritaville**
(Northern California Mexican restaurant, largely Spanish-speaking
clientele) and **Pete's** (a different clientele mix, closer to an even
split between Chinese- and Spanish-speaking guests). The app has to work
per-restaurant as a first-class concern — pick one, drill its real
content, track progress separately — because that's the actual shape of
daily use, not a hypothetical extensibility feature to build later.

Bilingual capability remains real, personal motivation specifically for
the Languages competency (a path to upward mobility — becoming the
person who can serve non-English-speaking guests confidently) — it's one
of six competencies now, not the whole product's premise the way it was
in the original single-role design.

**Target register, where Spanish delivery is involved:** formal,
professional Mexican Spanish (usted-based, standard professional
vocabulary, no regional slang or Peninsular forms like *vosotros*). Not
"neutral Latin American Spanish" — it should match what each
restaurant's actual kitchen staff and clientele speak, because that
reads as respectful and competent, not textbook-foreign.

## The Competency Model

Six restaurant-scoped competencies, split into two different shapes
(see "Two Competency Shapes" below for why):

- **Menu** — ingredient/dietary/pricing recall. 2-tier, text. The one
  being built with real depth right now
  (`apps/tico-talk/plans/tico-learn-ticket*.md`).
- **Off-Menu** — questions not on the printed menu that real guests ask
  anyway. 2-tier, text.
- **Recommendations** and **Upselling** — split into two rather than one
  "presentation quality" bucket; see the rubric below. 4-tier,
  voice-driven.
- **Complaints** — handling problems, including interpersonal conflict.
  4-tier, voice-driven.
- **Languages** — restaurant-specific by design: which languages, and in
  what ratio, depends on that restaurant's actual clientele. 4-tier,
  voice-driven.

This replaced an earlier single-role ("Host"), fixed-node-sequence
design — not because that design was wrong, but because it didn't
generalize across restaurants or roles. See "Later-Stage Direction"
below for what became of it.

**Why every competency is restaurant-scoped, not shared across
properties:** worked through concretely, competency by competency —
Upselling's *technique* is close to restaurant-agnostic, but it's always
practiced against a specific restaurant's real menu and situations, so
in practice it's scoped like the rest; Complaints is tied to each
restaurant's actual policy and empowerment level (what a host is allowed
to comp or promise varies); Languages is directly a function of a given
restaurant's real clientele mix. Content is structured with a canonical
(technique/mechanics, hardcoded) vs. restaurant-specific (facts, DB-
stored, correctable) split, so that if cross-restaurant technique
sharing becomes valuable later, it's a tracking change, not a content
rewrite — but for now, everything is tracked per restaurant.

**Procedural/mechanical skills are explicitly out of scope.** Several of
the original Host tree's nodes (seating logistics, water service,
hand-off mechanics) are about physically moving through a shift, not
knowledge or judgment — deliberately dropped rather than forced into one
of the six competencies. If procedural training belongs here later, it's
a separate, lighter bucket (see Open Questions).

## Two Competency Shapes: Knowledge (2-Tier, Text) vs. Judgment & Delivery (4-Tier, Voice)

Not every competency uses the same tier depth or the same primary
modality — the two groups are structurally different, not just at
different build stages of the same arc:

- **Menu and Off-Menu are knowledge competencies**: recall-based,
  text-driven, and capped at a **2-tier** model — Training → Capable.
  There isn't a meaningful delivery dimension to knowing that the carne
  asada burrito has no dairy; once it's known cold, it's known. No
  voice stage is currently planned for these two.
- **Recommendations, Upselling, Complaints, and Languages are judgment-
  and-delivery competencies**: real mastery means reading a guest and
  delivering in the moment, not just recalling a fact — so these use the
  full **4-tier** model (Training → Capable → Natural → Mastered) and
  are designed to be **voice-driven**. The current build (Ticket 6) is a
  light, prompt-driven *text* PoC for these — enough to validate content
  and the assurance/empathy rubric — not the intended long-term primary
  modality. Real Natural/Mastered progress on these four means real
  voice practice, once built.

This is why the original Host-role design (below) reads as the direct
ancestor of the second group specifically, not the first: its
cold-attempt, tiered, decay-capable, voice-based mechanic is exactly
what Recommendations/Upselling/Complaints/Languages need once they move
past the PoC stage — generalized across four competencies and
restaurants instead of one fixed Host tree at one restaurant. Menu and
Off-Menu don't inherit from it the same way; they're a simpler shape by
design, not an earlier stage of the same shape.

## Current MVP Scope

Target for this build phase (Tickets 4-7; see each for full mechanical
detail):

- **Menu** — multi-restaurant, text-based, two-pass (Basics → Complete)
  coverage drilling, working for both Margaritaville and Pete's, real
  Firestore-backed progress (Tickets 4-5).
- **Off-Menu** — built out enough to demonstrate real integration of
  actual off-menu knowledge — genuinely demoable and usable for
  learning, not a stub. Same 2-tier, text shape as Menu.
- **Recommendations, Upselling, Complaints, Languages** — live, real nav
  entries (not "coming soon" placeholders), wired up with enough of an
  experience to demo each lightly — mostly prompt-driven (Ticket 6), no
  coverage/tier tracking yet, since their real target modality is voice
  (see "Two Competency Shapes" above).
- **Management/GM demo view** (Ticket 7) — a rough, single-employee
  competency overview.

This doc stays the "why" — full detail lives in
`apps/tico-talk/plans/tico-learn-ticket*.md`.

## Progression Model: The Confidence Bar

Each competency (formerly: each node in a role's skill tree) carries its
own tier, not one overall percentage:

**Training → Capable → Natural → Mastered**

- Tiers advance **immediately** on a strong cold (first, unprompted)
  attempt — no multi-session confirmation required. The AI is treated as
  a reliable judge from a short exchange, provided its assessment rubric
  is explicit and consistent (see Design.md).
- Attempts taken *after* coaching or correction don't count toward
  advancement — only fresh, cold attempts are assessed. Parroting a fact
  or phrase you were just given isn't the same as producing it
  unprompted.
- **Decay is real.** A previously-mastered item that comes back weak on
  a cold check demotes and re-enters the coaching loop. The bar reflects
  current standing, not a permanent achievement.
- This lets a user of any starting level use the same app: a beginner
  slow-walks through early material across many sessions; someone
  already capable breezes through mastered material with a quick
  pulse-check and mostly engages at their real frontier.

This is real, tracked data — the kind of thing a user could show a
manager: not "completed Lesson 8," but "Capable on Menu at Margaritaville,
Natural at greeting guests in Spanish." It is **not shown directly to
the person it describes** — see "Staff-Facing Experience" below.

**Two depths of this same bar:** the four tiers above describe
Recommendations/Upselling/Complaints/Languages (and the original Host
design below). Menu and Off-Menu use a simplified two-tier version of
the same underlying philosophy — Training → Capable only — since their
text/recall shape has no meaningful delivery dimension to grade
Natural/Mastered against. See "Two Competency Shapes" above.

## Staff-Facing Experience: Coworker, Not Evaluator

A key refinement, reached through building and discussing an actual
practice screen: the tier model above is real and tracked, but *showing
it to the person being tracked* backfires. It reads as grading existing
job competence rather than practicing something still being learned,
which kills the low-stakes, game-like feeling the product depends on.
(This surfaced concretely: a Spanish-language prototype of this idea
genuinely felt fun and low-stakes to try; the identical mechanic,
imagined in English, started to feel like corporate compliance
training. The cause wasn't the language, it was visible grading.)

What this means for the staff-facing experience:

- **Tico behaves like an experienced coworker, not a teacher** —
  occasional observational tips, never a delivered score or correction
  presented as such.
- **Visible progress is a lived-experience tally** ("12 guests
  welcomed," "3rd shift") — not a bar, not a percentage. The tier model
  still runs invisibly underneath, deciding what gets served next, but
  is never displayed to the user as a grade.
- **Content is meant to come from combining axes** — situation (date
  night, family, business lunch, rainstorm...) × guest personality
  (nervous, chatty, celebrating...) × restaurant state (packed,
  waitlist, kitchen behind...) — rather than an exhaustive scripted
  curriculum. Not yet built as dynamic logic; documented here as the
  intended direction.
- **Any tip Tico shares must be real, verified hospitality knowledge** —
  never AI-invented pseudo-psychology presented as fact. A hard content
  constraint, not a style preference.
- **The tier model is the seed for a manager/GM-facing view**
  (aggregate team competency, not a personal report card) — now in
  active build as Ticket 7: a rough competency-tree view for a demo to
  Margaritaville's and Pete's GMs, intentionally light (single
  hardcoded employee, no real auth/identity system, no shift-scheduling
  integration) rather than a full build of what's described here.

**Honest current-state note:** the text-drill UI built so far (Menu,
Tickets 4-5) is closer to a straightforward drill screen than the full
"coworker, not evaluator" experience described above — that framing is
most fully realized once the voice/delivery stage and dynamic scenario
generation exist. The "No gamification" non-goal below is narrower than
it reads in light of this section: no streaks/points/badges in the
Duolingo sense, but a lived-experience tally and unlockable variety are
part of the design, not excluded by it.

## Phrasing Philosophy: Concepts Are Canonical, Phrasing Is Generative

There is no single "correct" canonical sentence per skill or fact —
there are canonical **concepts** (e.g., for Menu: an item's real
ingredients; for the original Host tree's "ask seating preference":
inside/outside, high-top/low-top, sun/shade). The AI generates natural
phrasing live, grounded in those concepts, rather than pulling from a
fixed phrasebook — this gives the user varied natural ways to express
the same functional need rather than training them to parrot one line.
Generated phrases are logged for future curation, not required to be
hand-authored up front.

## Assessment Rubric Grounding

Different competencies are evaluated against different rubrics, chosen
deliberately rather than defaulting to one generic "correct/incorrect"
or "good/bad" judgment:

- **Menu and Off-Menu** — pure recall correctness against real
  restaurant data (menu items; probable off-menu questions). This is the
  whole rubric for these two — it's also why they're capped at 2-tier:
  there's no second axis (like delivery or empathy) to grade a
  Natural/Mastered distinction against. See Design.md for Menu's
  two-pass mechanic.
- **Recommendations / Upselling** — two axes, grounded in DINESERV (a
  SERVQUAL adaptation for restaurants): **assurance** (trustworthy
  knowledge — is the recommendation actually accurate, a universal
  baseline) and **empathy** (reading the guest's actual state and
  calibrating — relational vs. transactional — rather than reciting a
  fact regardless of context). A correct-but-tone-deaf answer and a
  well-calibrated-but-wrong answer are different failure modes; feedback
  should name which one happened, not average them into one score.
  Deliberately **not** grounded in Wansink's descriptive-menu-label
  research — that work has real research misconduct and retractions
  behind it, not just contested findings, so it was ruled out rather
  than treated as one option among several.
- **Spanish voice delivery** (later-stage, see below) — naturalness,
  register, delivery/timing, comprehensibility. See Design.md Section 4.

## Later-Stage Direction: Host Role & Spanish Voice Practice

This section preserves the **original MVP design** — written and
partly built before the competency-model pivot above — because it is
the reference design for where Recommendations, Upselling, Complaints,
and Languages are headed once each grows past its text PoC into real
voice practice (see "Two Competency Shapes" above; Menu and Off-Menu
are not headed here — they stay text/2-tier by design). If you're
orienting to what Tico *currently does*, skip this section; if you're
planning the voice stage for one of the four voice-driven competencies,
this is the reference design.

**What it was:** a single role (Host), one fixed, hand-authored skill
tree, walked in order via live Spanish-language roleplay:

1. Greet & welcome
2. Ask party size
3. Ask seating preference (inside/outside, high-top/low-top, sun/shade)
4. Accommodations (e.g., high chair)
5. Seat guests & present menu (including specials)
6. Water service (ice/no ice, delivery)
7. Server hand-off ("your server will be right with you")

**Core experience:** the user presses "Prepare for Shift." The AI opens
a roleplay with a randomly generated Spanish-speaking guest (party size
and preferences vary), moving through the tree above beat by beat — a
cold attempt, an assessment, and only if needed, brief coaching and a
couple of drill reps before moving on (full mechanic in Design.md).
After 2-3 scenarios (~10 minutes), the session ends.

**Daily loop:** before-work practice session as above; no app
interaction during the shift itself; an optional after-work voice
reflection, captured but not automatically fed back into the curriculum
(see Non-Goals).

This tree and its mechanic are **not abandoned** — they're the natural
home for Recommendations/Upselling/Complaints/Languages' voice stage
once each moves past its text PoC, and the whole reason the
confidence-tier and audio-assessment ideas above exist. For those four
competencies specifically, text (recall, Capable) and voice (delivery,
Natural/Mastered) are two stages of one thing, not two eras of the
product.

## Non-Goals (Current)

- **No automated curriculum adaptation.** Post-shift voice reflections,
  once built, are captured but not automatically incorporated into
  competency content — that's a deliberate, manual authoring decision, not
  a live feature.
- **No automatic canon expansion.** If feedback surfaces a real gap,
  adding it is a deliberate authoring decision, not something the app
  does on its own.
- **No full-duplex/interruptible voice.** Push-to-talk is the right
  fidelity for the current design tier (see Design.md); realtime,
  interruptible conversation is a later difficulty lever.
- **No gamification** in the Duolingo sense — no streaks, points, or
  badges. A lived-experience tally and unlockable variety carry
  progression instead (see "Staff-Facing Experience").
- **No real identity/auth system.** Every user is an anonymous
  browser-generated id; the management view (Ticket 7) works around this
  with a single hardcoded employee label rather than real accounts.
- **No cross-restaurant progress sharing** (someone who's mastered a
  technique at one property redoing it at another) — blocked on the auth
  system above not existing (see Open Questions).

## Roadmap (Post Near-Term)

- **Additional roles:** Expo → Server → Bartender → restaurant
  management, using the same competency model.
- **Per-client customization as a real product surface:** real
  per-restaurant menu data already exists (Firestore, Ticket 4) —
  image-upload/OCR ingestion (rather than manual seeding) is the next
  step toward this being something an ownership group could adopt or
  require, potentially sold as seat-based access. A rough management/GM
  view (Ticket 7) is the first concrete step in that direction. One
  pricing idea, not decided: text-based access as the cheaper/default
  tier, voice-based access as a paid upgrade (per-user, or priced
  variably per seat for a restaurant group buying in bulk) — see Open
  Questions.
- **Language-agnostic version:** the same confidence-coaching mechanic
  (cold assessment → tiered mastery → decay/retrain) could train
  English-speaking new hires in guest-service skills generally,
  addressing restaurant industry turnover and onboarding — a different
  but related product, not required for or blocking the current build.
- **Difficulty tiers beyond the original Host design:** interruption,
  background noise, accented/regional speech, and reduced pause
  tolerance as levers once real conversational chaos (not prescribed
  exchanges) becomes part of the skill being trained.

## Guiding Principle

Everything should answer one question: **will this make the user more
confident during their next real shift?** If yes, it belongs. If not, it
probably doesn't.

## Data Principle

Established while first extracting Margaritaville's menu into
structured data, extended to every restaurant added since: menu data
(and restaurant notes, clientele profiles, anything factual about a
specific restaurant) is real, sourced, confirmed information — scanned
or typed from the actual menu, or a real correction from someone who
actually works there. It should never contain AI-interpreted content (a
synthesized flavor description, an inferred pairing, a
plausible-sounding placeholder for data that hasn't been supplied yet).
If a restaurant's clientele profile or complaint policy isn't populated,
the app should say so honestly rather than invent something
reasonable-sounding — the same principle applied everywhere this kind of
data shows up, not just the menu.

## Open Questions (Not Yet Decided)

- **Commute-practice vs. text-first tension.** The original vision (One-
  Line Pitch, Core Insight) includes practicing pre-shift during the
  commute — which by definition needs to be hands-free/voice, not text.
  Menu and Off-Menu being text-only conflicts with that specific use
  case for those two competencies. Genuinely unresolved, not just
  undecided in detail: near-term demos simply work around it, and
  text-first is still a workable way to learn/practice outside a
  commute. One idea floated, not committed: a global text-vs-voice
  toggle, so any competency could be practiced either way instead of
  modality being hardcoded per competency as it is now.
- **Pricing tied to modality.** If voice ends up meaningfully more
  expensive to run than text, text access could be the cheaper/default
  tier with voice as a paid upgrade — per-user, or priced variably per
  seat for a restaurant group buying access in bulk. Not decided; ties
  into the Roadmap's seat-based-access idea.
- **A small voice-mode teaser for the management demo.** Worth
  showing a taste of voice mode specifically for a GM/ownership-group
  meeting, since it's the more differentiated long-term pitch — but
  explicitly not a near-term build focus; text-based competencies and
  the Ticket 7 demo view come first.
- Whether cross-restaurant progress-sharing becomes real, and when —
  blocked on a real identity/auth system that doesn't exist yet, itself
  a substantial separate project.
- Whether procedural/mechanical skills (dropped from the six
  competencies) get a lightweight home later, or stay permanently out of
  scope.
- **Off-Menu content sourcing**: no obvious source of truth the way the
  printed menu has one. Planned approach: an LLM generates a "probable
  questions" canon, validated in the field against real kitchen/server
  knowledge, then structured into real content — a workflow to run, not
  yet something the app's UI needs to support directly.
- **Daily specials**: a commute-time review-and-drill feature from a
  snapshot of the day's specials sheet — ephemeral, snackable, no
  coverage tracking needed. Deliberately kept separate from the six
  competencies' architecture; a real idea, not yet built.
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
  character — literally embodies the "hip taco"/"Tico" wordplay and gives
  the coaching voice a warm, approachable personality rather than a
  generic AI assistant feel. Visual/personality design is a later step,
  not blocking the current build.
