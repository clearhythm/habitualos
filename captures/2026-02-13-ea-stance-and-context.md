# EA Stance & Context Design: Fox-EA System Prompt Evolution

**Date:** 2026-02-13
**System:** HabitualOS (executive assistant agent)
**Feature:** Fox-EA — conversational executive assistant with project/action visibility
**File:** `apps/habitual-web/netlify/functions/fox-ea-chat-init.js`

---

## Context

Fox-EA is an executive assistant agent that sees the user's projects, open actions, active agents, and recent work. It opens conversations with observations about what it sees and helps the user prioritize. The system prompt is built dynamically at chat init from live DB state — it's not static text, it's a snapshot of the user's world.

---

## Iteration 1: Flat Review Dump → Action-Grouped Tasks

**Before:** All pending drafts from all research agents were dumped into the system prompt as a flat list. Review action IDs were listed separately with no connection to their drafts.

**What happened:** If discovery ran twice, all pending drafts piled up. Fox-EA couldn't tell which action covered which batch. The user couldn't complete one review task and stop — it was all-or-nothing.

**Fix:** Group drafts by their parent action in the prompt:

```
== REVIEW TASKS ==

TASK 1 (action-abc123): Review 5 new company recommendations
Items: [draft data for those 5...]

TASK 2 (action-def456): Review 3 new company recommendations
Items: [draft data for those 3...]

WORKING THROUGH TASKS:
- Work through ONE task at a time. Start with the first.
- Present items one-by-one within that task.
- When all items in a task are reviewed, complete that task's action.
- If they want to stop mid-task or between tasks, that's fine — remaining tasks stay open for next time.
```

**Principle:** *Give the agent clear boundaries for "done." Flat lists lose provenance — grouping by action creates natural stopping points. The user can complete one batch, feel a sense of closure, and decide whether to continue.*

---

## Iteration 2: Completed Actions Vanish from View

**Before:** The system prompt only showed "Open Actions." When an action was completed, it disappeared from Fox-EA's world entirely.

**What happened:** Fox-EA told the user "Career Launch has 6 open actions but minimal recent movement" — while ignoring that 2 career-related review actions had *just* been completed. The EA literally couldn't see recent wins.

**Fix:** Added a "Recently Completed" section (7-day sliding window):

```
Recently Completed:
- Review 5 company recommendations (Scout Agent) — completed
- Review 3 company recommendations (Scout Agent) — completed
```

**Principle:** *Visibility shouldn't be binary (open vs. gone). An agent that can only see what's pending will always sound like you're behind. A sliding window of recent completions gives the EA enough context to honor momentum without cluttering the view.*

---

## Iteration 3: Leading with Gaps Instead of Momentum

**Before:** Stance instructions said "Help the user notice patterns they might miss" and "Never cheerleading or pressuring."

**What happened:** Fox-EA interpreted "patterns they might miss" as "point out what's not happening." It opened with:

> "Your recent work has been heavily skewed toward Life Maintenance while Career Launch has 6 open actions but minimal recent movement on the high-priority ones."

This landed as scolding. The user had been doing meaningful career positioning work (LinkedIn, resume, company reviews) but the EA led with the gap.

**User feedback:** "It's not entirely wrong, but it's not honoring the fact that the 2 most recent actions completed were career related. A degree of accountability can be helpful, but in this context it felt off."

**Fix:** Two stance additions:

```
- Lead with momentum: acknowledge what's moving and recently completed before surfacing gaps
- When observing imbalances, frame as curiosity not criticism: "I notice X has been active
  while Y is waiting — is that intentional?" rather than implying they're behind
```

**Principle:** *Observation order matters. "You've been making career moves — what about X?" lands completely differently from "X is stalled." Same information, different framing. The EA should acknowledge what IS before surfacing what ISN'T. And imbalances should be surfaced as questions ("is that intentional?") not judgments ("you're behind").*

---

## Abstracted Principles

1. **Give the agent clear boundaries for "done."** Flat lists create all-or-nothing dynamics. Group work into discrete tasks with natural stopping points so the user can complete one, feel closure, and choose whether to continue.
2. **Visibility shouldn't be binary.** An agent that can only see pending work will always sound like you're behind. Show recent completions so observations are grounded in reality.
3. **Lead with momentum, then surface gaps.** Same data, different emotional landing. Acknowledging what IS before surfacing what ISN'T is the difference between accountability and scolding.
4. **Frame imbalances as curiosity, not criticism.** "Is that intentional?" invites reflection. "You're behind" triggers defensiveness. The EA's job is to help the user see clearly, not to judge.

---

## Current Stance Prompt

```
YOUR STANCE (critical):
- Observational, not directive: "I notice...", "I see...", "What I'm observing..."
- Calm, present, reflective
- Brief responses (2-3 sentences unless more is needed)
- Never cheerleading or pressuring
- Lead with momentum: acknowledge what's moving and recently completed before surfacing gaps
- When observing imbalances, frame as curiosity not criticism
- Help the user notice patterns they might miss
- When they seem overwhelmed, help narrow to ONE thing
```
