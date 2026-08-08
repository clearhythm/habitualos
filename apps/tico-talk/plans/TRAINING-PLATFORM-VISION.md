# Training platform — bigger app-model vision (not a spec, not scheduled)

Rough sketch of where the real app is headed, captured so it doesn't get
lost — deliberately not detailed enough to build from directly. Refined
into real tickets once there's enough to learn from; expect this doc to
keep changing as building and using the thing surfaces things planning
alone couldn't. When a ticket's execution teaches us something that
changes the picture, that insight belongs back in this file, not just in
the ticket that found it. Renamed from `MENU-KNOWLEDGE-VISION.md` once
the scope grew past just the menu.

## Origin: the menu/drill idea (built, Tickets 1-5)

The original two-part idea from this doc's first version is now real:
practice grouped per actual menu section rather than one monolithic
blob (Tickets 1-2), and a coverage map distinguishing not-yet-touched /
attempted-but-shaky / demonstrated-correctly rather than a separate
confidence score (Tickets 3-5, landing on a two-pass Basics/Complete
model: ingredients first, then dietary+pricing, gated). That validated
the core hypothesis this doc started with — worth remembering as the
proof point when the bigger version below feels speculative.

## The competency framework shift

Started as one "Host" skill tree in Practice (Support: Welcome &
Seating, Menu Knowledge, Managing Waits, Table Presence — Server:
Recommendations & Upselling, Beverage Knowledge, Taking Orders, Service
Flow, Service Recovery, Closing the Experience — Specialty Craft:
Spanish Service), eleven categories deep, mixing two genuinely different
kinds of skill without distinguishing them.

Replaced with six competency areas, all knowledge-and-judgment, not
procedural:

- **Menu** — the current /learn/ drill (ingredients, dietary, pricing).
- **Off-Menu** — questions not on the printed menu but real guests
  actually ask (substitutions, off-menu items, prep details).
- **Recommendations** — pairings, suggestions, reading what a guest
  actually wants.
- **Upselling** — same underlying technique as Recommendations but a
  distinct axis (see rubric section below), not folded into one
  "presentation quality" bucket.
- **Complaints** — handling problems, including interpersonal conflict.
- **Languages** — restaurant-specific, not a generic module (see below).

**Procedural/mechanical skills are explicitly out of scope for now.**
Welcome & Seating, Managing Waits, Table Presence, Taking Orders,
Service Flow, and Closing the Experience don't map onto the six areas
above — they're "how you physically move through a shift," not
knowledge or judgment, and this app is about the latter. Decision:
drop them for now rather than force a fit. If procedural training ever
belongs here, it'd be a distinct, lighter "Logistics" or "Procedural"
bucket, not squeezed into the six competencies — not compelling enough
to build yet.

**Learn and Practice stop being separate top-level modes.** Each
competency owns its own progression instead: text-drill (recall) as an
early stage, voice-practice (delivery) as a later one, where that
distinction actually applies. Menu is mostly text with recall gated at
Capable; Recommendations/Upselling are mostly voice/delivery, maybe with
a light text knowledge-check first. Not every competency needs both
stages — Menu's voice cap-stone (recommending based on what's now
known) is a small addition, not a parallel Practice section to visit
separately.

**Cross-role relevance**: this framework isn't server-only. Support
staff can use Menu/Off-Menu/Recommendations mastery to prove readiness
for greet shifts, not just servers refining upsell skill — the same six
competencies, read differently depending on which shifts someone's
trying to qualify for. Not something to build now, but the taxonomy
shouldn't accidentally assume "server" as the only consumer.

## Multi-restaurant architecture

Erik is now working at Pete's more or less full-time, on top of
Margaritaville. The app needs to actually work across both: switch
restaurants, separate menu/content per restaurant, separate tracked
progress per restaurant. This isn't a side feature, it's foundational —
"Menu" as a competency doesn't mean anything until the app knows which
restaurant's menu, so this has to land before Menu/Off-Menu get rebuilt
with real depth.

**Restaurant becomes a first-class entity.** Menu data, restaurant
notes, and progress-per-competency all get keyed by restaurant, not
assumed singular. The sidebar's restaurant label becomes an actual
switcher.

**Restaurant-specific config goes beyond the menu.** Languages is the
clearest example: which languages matter, and in what ratio, is a
property of that restaurant's actual clientele, not a universal
constant. Margaritaville skews heavily Spanish-speaking; Pete's might be
a more even Chinese/Spanish mix. A restaurant's setup needs a
clientele/demographics profile alongside its menu data for Languages to
mean anything.

**Everything is restaurant-scoped for now, on purpose, even where a
"canonical" layer conceptually exists underneath.** Considered whether
Recommendations/Upselling/Complaints/Languages should be restaurant-
agnostic (the underlying skill arguably transfers: someone good at
reading a table's mood at one restaurant is probably good at it
anywhere) or restaurant-specific (the content, scenarios, and even
policy — complaint handling in particular may depend on the
restaurant's tier/business logic — genuinely differ). Landed on: track
everything per-restaurant for now, simplest, and matches how even
"universal" skills still get drilled through that restaurant's specific
content. The real fix (a server who's worked both places shouldn't have
to redo shared universal training from scratch) needs actual
identity/auth to hang cross-restaurant progress on, which doesn't exist
in this app yet — see the management-layer section below. Don't solve
this now; don't build something that forecloses it either.

## Canonical vs. restaurant-specific content

Even though progress-tracking stays restaurant-scoped for now, the
*content* for competencies like Upselling should still be structured as
two layers from day one: a canonical/universal block (the actual
technique — how to notice an opening, phrasing, timing, general
complaint-handling philosophy) and a restaurant-specific block (that
restaurant's menu to practice upselling against, or its specific
complaint/comp policy, or which languages/ratios apply). This isn't
speculative architecture — it's the same shared-block/section-block
split `learn-chat-init.cjs` already uses for Anthropic prompt caching,
reused for a different reason. Structuring content this way now means
that if cross-restaurant progress-sharing becomes real later, it's a
tracking change, not a content rewrite, since the canonical parts were
already isolated.

## The evidence-quality thread (rubric grounding)

Wansink's descriptive-menu-label research (the "juicy, tender" label
studies commonly cited for menu psychology) is compromised — real
research misconduct and retractions, not just contested findings — and
shouldn't ground anything here. DINESERV (a SERVQUAL adaptation for
restaurants) is more credible, and its **assurance** and **empathy**
dimensions map cleanly onto a real distinction for how Recommendations
and Upselling should actually be assessed:

- **Assurance** — trustworthy knowledge as a universal baseline. Do you
  actually know accurate things to recommend? This is closer to Menu's
  correctness-based rubric, just applied to recommendation content.
- **Empathy** — reading the guest's actual state and calibrating
  approach accordingly (relational vs. transactional). Can you tell
  whether this table wants a chatty, personal interaction or a quick,
  efficient one, and adjust?

These are two separate axes, not one blended "presentation quality"
score. A correct-but-tone-deaf recommendation and a well-calibrated but
factually wrong one are different failure modes, and the rubric should
say which one happened, not average them into a single number. Worth
carrying into the prompt-layer design for Recommendations/Upselling
specifically when that gets built (sequencing step 3 below).

## Management/employee-tracking layer — a separate, later initiative

"Management-visible tiers tied to shift allocation" and "employee data
at the hospitality-group level" (since staff are assigned across
properties) are real goals, but both assume a real identity/auth system
tied to an actual employee record, with manager-facing permissions.
**None of that exists in this app** — every user is currently just an
anonymous `u-xxxxxxxx` in localStorage, no accounts, no login. This
layer sits on top of a prerequisite that hasn't been built, and building
that prerequisite is its own substantial project. Don't fold this into
the near-term competency work; treat it as a distinct future initiative
once there's real auth to hang it on.

For now, the achievable version of "something to show management" is a
rough competency overview (sequencing step 4) built on top of whatever's
actually tracked by that point, not real manager tooling.

## Off-Menu content sourcing (a process, not a build spec)

Off-Menu doesn't have an obvious source of truth the way the printed
menu does. Planned approach: an LLM generates a "probable questions"
canon (candidate off-menu questions real guests are likely to ask),
Erik validates it in the field against actual kitchen/server knowledge,
then the validated set gets structured into real content. This is a
content-creation workflow to run before/alongside building Off-Menu's
drill, not something the app's UI needs to support directly yet — though
a lightweight review/validation UI could make sense once there's a
sense of how much content this actually produces.

## Daily specials — separate, lightweight, not part of the tier model

A commute-time review-and-drill feature built from a snapshot of the
day's specials sheet. Explicitly kept separate from the six-competency
tier model — it's ephemeral (today's specials, not persistent
knowledge), snackable, and doesn't need coverage tracking, tiers, or
gating. Worth building at some point but shouldn't get tangled into the
Menu/Off-Menu/etc. architecture.

## Build sequencing

1. **Multi-restaurant infrastructure**, including the sidebar/nav
   restructuring (restaurant switcher, "My Training" replacing
   Learn/Practice/Progression with the six competencies — only Menu
   functional at first, the rest coming-soon). Foundation everything
   else sits on.
2. **Menu + Off-Menu, built with real depth** — Tickets 4/5's work,
   reworked to be restaurant-aware instead of hardcoded to
   Margaritaville, plus Off-Menu once its content-sourcing pass has
   something real to build from.
3. **Recommendations, Upselling, Complaints, Languages — light
   prompt-layer PoC pass.** Not the full coverage/tier machinery Menu
   gets, canonical+restaurant-specific block split from the start, the
   assurance/empathy rubric split for Recommendations/Upselling
   specifically.
4. **Rough employee/competency overview** as the management-demo
   artifact. Separate GM conversations planned for Margaritaville and
   Pete's, with an analytics angle specifically from Pete's GM worth
   keeping in mind for what this view actually needs to show.

## Data principle established while extracting the menu

The menu JSON (now Firestore, `restaurant-config/menu` per Ticket 4) is
the canonical factual reference — scanned menu data, or confirmed
real-world corrections from actually working there (portion sizes,
off-menu customization, etc.). It should never contain AI-interpreted
content (a synthesized flavor description, an inferred pairing,
anything not independently verifiable). If that kind of color is ever
wanted somewhere, it happens live in a model call at request time — it
doesn't get stored as if it were fact. This principle should extend to
the restaurant-specific config data (clientele/language profiles,
complaint policy, etc.) added for multi-restaurant support — real,
sourced, confirmed data, not model-invented plausible-sounding filler.

## Explicitly not decided yet

- Whether cross-restaurant progress-sharing (someone who's mastered
  Upselling technique at one property shouldn't redo it at another)
  becomes real, and when — blocked on identity/auth, see above.
- Whether procedural/mechanical skills get a lightweight home later
  (a "Logistics" bucket) or stay permanently out of scope.
- Exact shape of the Off-Menu content-sourcing workflow once there's a
  real batch of LLM-proposed questions to validate against.
- What the management/competency-overview demo artifact actually needs
  to show — deferred until closer to that build step, informed by the
  separate Margaritaville/Pete's GM conversations.
- Whether dish-level correction granularity (vs. the section/restaurant
  scope the flag-and-confirm flow currently supports) ever becomes
  worth the added complexity — noted, deferred, in Ticket 4's design too.
