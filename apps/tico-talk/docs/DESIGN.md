# Design — Tico (MVP Mechanics)

*Working name: **Tico** (formerly "Hip Taco"). See Vision.md for the naming
rationale and trademark note.*

This document covers *how the core loop actually works* — the state model,
the session flow, and the assessment logic. It intentionally excludes tech
stack / infra decisions, which belong in a separate architecture doc written
against HabitualOS (11ty/Nunjucks/Netlify) once this is settled.

## 1. Skill Tree (Host, MVP)

A fixed, hand-authored, ordered sequence of nodes:

1. Greet & welcome
2. Ask party size
3. Ask seating preference (inside/outside, high-top/low-top, sun/shade)
4. Accommodations (e.g., high chair)
5. Seat guests & present menu (incl. specials)
6. Water service (ice/no ice, delivery)
7. Server hand-off ("your server will be right with you")

Each node stores canonical **concepts** it must convey — not canonical
sentences. Example, node 3:

```
concepts: [inside_vs_outside, high_top_vs_low_top, sun_vs_shade]
```

The tree order is meaningful: it mirrors the real sequence of a host
interaction, and scenarios walk it in order because you can't sensibly
discuss water service before you've seated the guest.

## 2. Confidence Tiers

Each node independently carries one of:

```
Training → Capable → Natural → Mastered
```

- Advancement is **immediate** on a single strong cold attempt.
- Only **cold, unprompted** attempts count toward tier changes. Drill reps
  taken after coaching never move the tier.
- **Decay/retrain:** a weak cold check on a previously-mastered node demotes
  it and re-enters the coaching loop.
- Tiers persist per user, per node, indefinitely (this is the profile a user
  could show a manager).

## 3. Session Flow

A session = "Prepare for Shift" = 2-3 scenarios, ~10 minutes.

**A scenario** = one continuous roleplay with a randomly generated guest
(party size, seating preference, etc. vary), walked through the tree in
order from node 1.

### Turn granularity is user-determined, not fixed by the tree

The tree (Section 1) is granular by design — each concept is its own node.
But a real turn of speech doesn't have to map 1:1 to a node. The user might
complete a turn with just a greeting, or might greet, ask party size, and
ask seating preference all in one breath. **The app adapts to whatever the
user actually said**, matching their utterance against however many nodes
it happens to cover, rather than forcing one node per prompt-response cycle.

Practically: after each user turn, the assessment step checks which node(s)
were addressed (one or several) and evaluates/advances each accordingly. If
the user's turn skips ahead of the frontier node span or leaves a node
untouched, the AI's next in-character line naturally prompts for what's
still missing (e.g., if the user greeted but didn't ask party size, the
guest's next line invites that — "Somos cuatro" wouldn't come until asked,
so the scene holds until it's addressed). The tree stays the source of
truth for what's been covered and at what tier; it just doesn't dictate the
shape of the user's speech.

### Per-node behavior within a scenario

The behavior at each node depends on that node's *current* tier for this
user:

**If node is already Natural or Mastered (not the frontier):**
- Guest-in-character prompt triggers the beat.
- User responds (cold).
- AI silently assesses. If it still holds, brief in-character or one-line
  coach acknowledgment ("nice, that landed") — no drilling, no context
  break. Advance immediately to next node.
- This is a pulse-check, not practice — it exists to detect decay, not to
  re-teach.

**If node is the frontier (first node below target tier for this session):**
- Guest-in-character prompt triggers the beat.
- User responds (cold). This is the assessed attempt.
- AI rates it against the rubric (Section 4).
  - **If it already reads strong:** brief acknowledgment, tier advances
    immediately, no coaching needed, move to next node.
  - **If it doesn't yet clear the tier bar:** AI steps out of character and
    offers the choice out loud — e.g. *"That felt pretty natural — want a
    couple of pointers to refine it?"* User accepts/declines by voice.
    - If accepted: brief correction, 1-2 natural alternative phrasings,
      1-2 drill reps of a target phrase. Then AI steps back into character
      and the scenario resumes at the same beat (or advances, depending on
      whether the drilled attempt is treated as informative-only — drills
      never themselves count as the assessed attempt).
    - If declined: move on anyway; tier does not advance this pass.

**Nodes beyond the frontier:** not reached this scenario — sequencing means
the roleplay hasn't gotten there yet.

### Character continuity

The roleplay persona and scenario context (this specific guest, this
specific table request) **persists across coaching breaks** within a
scenario. The AI steps out of character to coach, then resumes the *same*
interaction — it does not reset the roleplay per beat.

### Session start point

Each session starts at node 1 of the tree and walks forward. Already-solid
nodes move quickly (pulse-check only); the session's real time budget is
spent at whatever the user's actual frontier is. This means a total beginner
and an advanced user can use an identical session structure — the pacing
naturally differs based on tier state, not branching logic.

## 4. Assessment Rubric (Explicit, for Consistency)

Because tier advancement is immediate and audio-based judgment can otherwise
drift session to session, the AI's assessment should be grounded in a
short, explicit rubric rather than open-ended judgment. Suggested axes:

- **Naturalness of phrasing** — would a native, professional Mexican
  Spanish speaker in this role plausibly say it this way?
- **Register** — formal/professional (usted-based), no slang, no
  Peninsular forms (e.g., no *vosotros*).
- **Delivery/timing** — fluency of production, not just correctness;
  hesitation and halting delivery should read as "not yet natural" even if
  words are technically right.
- **Comprehensibility to a guest** — would a real guest understand this
  cleanly in the moment?

This rubric is what actually goes in the system prompt driving assessment.
It does not need to be rigid or numerically scored — it needs to be
**consistent**, so "Mastered" means the same thing on Tuesday and Friday.

## 5. Target Language Register

**Formal, professional Mexican Spanish.** Usted-based. Standard professional
vocabulary. No regional slang or caló. Explicitly not Peninsular Spanish
(avoid *vosotros* and other Spain-specific forms) and not a generic "neutral
Latin American" blend — it should match what the restaurant's actual kitchen
staff and clientele speak, since that reads as respectful and competent
rather than foreign-in-a-different-direction.

## 6. Phrase Generation vs. Storage

- **Not stored:** canonical sentences per node. There is no fixed
  phrasebook to maintain.
- **Stored (canonical):** the concept list per node (Section 1).
- **Generated live:** actual target phrasing, grounded in the node's
  concepts and the rubric/register above. This naturally produces 2-3
  varied natural phrasings across sessions rather than one memorized line.
- **Logged (not yet used):** every AI-generated phrase, tagged by node and
  session, for future manual curation. No feature consumes this log in MVP —
  it's just captured so it exists later.

## 7. Post-Shift Reflection (MVP Scope)

- Optional voice reflection after work, transcribed and stored.
- **Not automatically applied** to future sessions, tree structure, or
  scenario content in MVP. It's captured data, reviewed and acted on
  manually (e.g., in a future Claude Code authoring session) if it surfaces
  a real canonical gap.
- If no reflection is given, the app simply proceeds with the default
  tree/session flow next time.

## 8. Voice Interaction Model (MVP)

**Push-to-talk**, not full-duplex/auto-VAD. Rationale:

- Host-level interactions are inherently brief, turn-taking exchanges in
  real life too (guest asks, host answers) — the realism gap versus full
  duplex is small at this tier.
- The skill being trained at Host is word retrieval and natural delivery
  under mild pressure, not interruption-handling or conversational overlap.
- Push-to-talk also gives the user thinking time, which is a reasonable
  proxy for a real beginner's experience, not just a technical shortcut.

**This is explicitly a tier-1 choice, not an architectural ceiling.**
Later roles/difficulty levels (busy shift, rude customer, Server-tier
genuine back-and-forth) are where auto-VAD, interruption, and reduced pause
tolerance become the actual skill under test — introduced as a difficulty
lever, not a rebuild.

## 9. Interaction Language Model (MVP)

Each scenario beat has three distinct language "slots," and they are not
all in the same language for MVP:

- **Scenario setup / prompt:** in **English**. ("A Spanish-speaking couple
  walks in. How do you greet them?") This orients the user quickly without
  requiring them to parse instructions in their target language.
- **User's turn:** in **Spanish** (the actual practiced skill). If the user
  fumbles, mixes in English, or can't produce it, that's noted as part of
  the assessment rather than treated as a hard failure — see Section 4.
- **Coach feedback:** in **English**, with corrections and target
  phrases given in **Spanish**. This keeps feedback maximally clear (the
  user isn't decoding coaching in a language they're still building
  confidence in) while the actual practice material stays in Spanish.

**Deferred (not MVP):** an "advanced mode" where coach feedback itself is
delivered in Spanish, for users far enough along that English-language
scaffolding is no longer needed. Flagged here so the language-slot design
doesn't need rework later — advanced mode is a matter of switching the
feedback slot's language, not restructuring the interaction model.

## 10. Explicitly Deferred (Not MVP)

- Automated tree/canon expansion from reflections or in-session misses.
- Per-restaurant menu ingestion (OCR, image upload) — relevant starting at
  Server tier.
- Multi-session confirmation before tier advancement (single strong cold
  attempt is sufficient per current design).
- Full-duplex / interruptible voice.
- Additional roles beyond Host.
- Regional variants beyond formal Mexican Spanish.
