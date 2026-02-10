# Conversational AI Design: Survey Check-in Flow

**Date:** 2026-02-10
**System:** Pidgerton (relationship companion app)
**Feature:** Weekly survey check-in via conversational agent
**File:** `apps/relationship-web/netlify/functions/rely-chat-init.js`

---

## Context

Users (a couple) each filled out a longer relationship survey independently. From those results, 5 focus dimensions were computed — 3 lowest-scoring + 2 highest. Each week, an agent guides each user through a conversational check-in on those 5 dimensions (0-10 scale). The goal: track how things shift over time without making it feel clinical.

---

## Iteration 1: The Dump

**Prompt instruction:**
> "Ask about 1-2 dimensions at a time, not all at once"

**What happened:** Agent presented multiple dimensions in a single message. Asked for scores on 2-3 at once.

**User feedback:** "The agent should NEVER present multiple categories at once."

**Principle discovered:** *"1-2 at a time" is a hedge. The agent will always pick the lazier interpretation. Be absolute: ONE.*

---

## Iteration 2: One at a Time + Cold Start

**Prompt change:**
> "Ask about ONE dimension at a time. Never combine multiple dimensions in a single question."

Added first-time detection (`isFirstWeekly` flag) with explanation bullets about what the survey is and why.

**What happened:** Agent explained the survey well but immediately launched into the first dimension question in the same message.

**User feedback:** "Once the 'what the survey is about' is presented, it should check in — 'Does that make sense?' — so it's more conversational."

**Principle discovered:** *Every context shift deserves a checkpoint. Explanations without pauses aren't conversations — they're lectures.*

---

## Iteration 3: Pause and Confirm

**Prompt change:**
> "After the explanation, pause and ask 'Does that make sense?' — wait for their response before starting the first question. Do NOT jump into the dimensions until they confirm they're ready."

**What happened:** Agent now paused. User confirmed. Agent began asking one dimension at a time. But it was over-conversing — asking follow-up questions even when the user had already provided context.

**User feedback:** "If I just give it a number, it's okay to ask follow-up. But if I give it some context for WHY I'm giving that score, I don't want it to ask follow-ups."

**Principle discovered:** *Match your depth to their depth. If someone gives you signal, don't ask for more signal.*

---

## Iteration 4: Conditional Follow-ups

**Prompt change:**
> "If they give just a number with no context, ask one brief follow-up: what's behind that score?"
> "If they give a number WITH context, do NOT ask follow-ups. Reflect briefly (1-2 sentences of compassionate acknowledgment), then move on to the next dimension."
> "Never linger on a dimension longer than needed. The goal is to keep moving."

**What happened:** Agent now moved efficiently. But the reflections were flat:

> *"That sounds heavy — the uncertainty about income combined with not being aligned on how to handle money is a tough combination. I hear you."*

**User feedback:** "That's great to be heard, but I also want a bit of encouragement. Like 'over time we'll see if we can shift this' on low items, and 'we'll see how we can continue this' on higher items. Right now it's landing a bit flat."

**Principle discovered:** *Empathy without direction is just mirroring. The user wants to feel like the process is going somewhere.*

---

## Iteration 5: Score-Aware Reflections

**Prompt change:**
> "Tailor your reflection to the score:
>   - Low scores (0-4): Acknowledge the difficulty, then add a note of forward momentum — 'this is exactly the kind of thing tracking over time can help with' or 'naming it is the first step.'
>   - High scores (7-10): Celebrate briefly — 'worth paying attention to what makes this work' or 'that's something to keep building on.'
>   - Mid scores (5-6): Neutral acknowledgment is fine."
> "Vary your language. Don't repeat the same reflection pattern for every dimension."

**What happened:** [Agent responses cleared before capture — need to test next session]

**Principle discovered:** *Reflection needs a gradient. Low scores need hope. High scores need celebration. Mid scores need a light touch. And repetition kills the illusion of conversation.*

---

## Abstracted Principles

1. **Be absolute, not hedging.** "1-2 at a time" = agent picks the lazy path. "ONE at a time. Never combine." = works.
2. **Checkpoint before context shifts.** Any time the conversation changes mode, pause and confirm readiness.
3. **Match depth to depth.** If the user provides context, acknowledge and advance. Only probe when they give you nothing.
4. **Empathy needs direction.** Pure mirroring ("I hear you") feels hollow. Tie reflections to forward momentum or celebration.
5. **Vary your patterns.** Explicit instruction to not repeat phrasing. Without this, agents fall into templates.

---

## Missing from this capture

- **Agent response screenshots/text:** Chat was cleared between iterations. Future sessions: copy agent response text before clearing.
- **Exact user messages during survey:** The actual back-and-forth that exposed each issue is lost.
- **Tone nuance:** Hard to capture in text what "landing flat" feels like vs. what "landing well" feels like.

## Notes for future capture system

- Need to grab agent response text BEFORE clearing chat (even just a copy-paste dump)
- Git diffs of the prompt file are the most reliable artifact — they survive
- User feedback in Claude Code session is the second-best source (available in context during session, lost after)
- The "next day" is the right time to write the article — not during the session, not weeks later
