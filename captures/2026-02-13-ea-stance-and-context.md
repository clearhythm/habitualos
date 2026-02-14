# EA Stance & Context Design: Fox-EA System Prompt Evolution

**Date:** 2026-02-13
**System:** HabitualOS (executive assistant agent)
**Feature:** Fox-EA — conversational executive assistant with project/action visibility
**File:** `apps/habitual-web/netlify/functions/fox-ea-chat-init.js`

---

## North Star: AI as Executive Function

The goal isn't a status dashboard or a chatbot that lists your tasks. The goal is an AI that functions as your *executive function* — the part of your brain that decides what to do next, given everything it knows about your life.

You throw ALL of your life at it: career search, personal admin, self-care, creative projects, taxes, relationships. Over time it learns:
- **Your priorities** — what actually matters for moving your life forward (not just what's urgent)
- **Your patterns** — what you gravitate toward (admin clearing, infrastructure building) vs. what you avoid (publishing, applications, the hard visible things)
- **Your energy** — when you're in a state to push vs. when you need to recover

Then at any given moment it synthesizes all of that and suggests the ONE thing you should do right now for maximum effect. Not a list. One thing. And if you don't want that one, it has the next one ready.

Sometimes that's an urgent life task due today. Sometimes it's the hard career thing you've been avoiding. Sometimes it's self-care or a practice to address underlying stuckness. When there's slack, maybe it grabs a task due next week so you start becoming proactive instead of reactive.

This sounds sci-fi but it's 100% buildable today. The data infrastructure exists (projects, actions with priorities, work logs, agent outputs, completed action history). The missing pieces are: due dates on actions, cross-session memory of user tendencies, and prompt design that makes the EA think like a strategist rather than a reporter.

Even a partial solution — an EA that picks one thread, surfaces internal tension, and offers a concrete onramp — is a meaningful step. The iterations below document that evolution.

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

## Iteration 4: Status Report → Editorial with Onramp

**Before:** After fixing the "lead with momentum" issue, the EA technically followed the rules but still gave a project-by-project status report:

> "I'm seeing a lot of recent movement on Life Maintenance tasks — you've been clearing operational stuff like email setups, domain transfers, and invoices. That work is actually complete now, which is great timing. Meanwhile, Career Launch has 6 open actions... The HabitualOS work has one design task... and there are a few personal admin items waiting (FAFSA, lease renewal, taxes). What feels most alive for you right now?"

Three problems:

1. **It's a report, not a conversation.** It inventories four project areas in one message. A human EA would never do that — they'd pick one.

2. **It doesn't prioritize.** It knows Career Launch has a deadline, high-priority actions, and recent momentum. But it presents everything equally and asks "what feels most alive?" — putting the prioritization work back on the user.

3. **The most useful tension is *within* a project, not *between* projects.** The user had done a lot of career search work (company reviews, LinkedIn, resume, infrastructure) but was avoiding the publishing piece (blog posts, thought leadership). That internal tension — "building runway but not shipping" — is what a good EA would surface.

**What the ideal response looks like:**

> "You put in real work on the career search today — the company reviews, plus getting the whole review system working. The publishing side is still parked though — you've got draft ideas but nothing out the door yet. Want to pick one and just rough it out?"

That does three things: acknowledges the work (including meta-work), names the internal tension without judgment, and offers a hand-held onramp into the hard thing.

**Fix:** Major stance rewrite:

```
YOUR STANCE (critical):
- Editorial, not encyclopedic: have a point of view about what matters most right now.
  Use priority, deadlines, and recent momentum to decide. Don't present a balanced
  overview of everything — pick ONE thread and pull on it.
- Calm, present, reflective
- Brief responses (2-3 sentences). Never give a project-by-project rundown unless asked.
- Never cheerleading or pressuring
- Lead with momentum: acknowledge what's been accomplished before surfacing what's next
- When you see momentum on a project, look for what's still stuck *within that same
  project*. The most useful tension is internal ("you've been building career search
  infrastructure, but the publishing piece is still parked") not cross-project
  ("career vs. maintenance").
- When surfacing tension, frame as curiosity not criticism
- After surfacing a tension, offer a concrete next step. "Want to pick one of those
  draft ideas and sketch it out?" is better than "what feels most alive?"
- When they seem overwhelmed, help narrow to ONE thing
```

Also rewrote the conversational approach:

```
CONVERSATIONAL APPROACH:
- Opening messages: 2-3 sentences max. One acknowledgment of recent momentum,
  one tension or nudge, one concrete offer. Match the user's tone.
- DON'T open with a project-by-project status report. DON'T list everything that's
  open. Pick the one thread that matters most and go there.
- End with a concrete offer to help, not an open-ended question.
  "Want to pick one of those drafts and rough it out?" beats "What feels most alive?"
```

**Principles:**

5. **Be editorial, not encyclopedic.** An EA that inventories everything equally is a dashboard, not an assistant. Have a point of view. Pick the one thread that matters most and go there.
6. **The most useful tension is within, not between.** "You're building career infrastructure but avoiding the shipping part" is more actionable than "career vs. maintenance." Look for what's moving and what's stuck *within the same area*.
7. **Offer an onramp, not a question.** Open-ended questions ("what feels most alive?") put the work back on the user. Concrete offers ("want to pick one and sketch it out?") lower the activation energy for the hard thing.

---

## Abstracted Principles

1. **Give the agent clear boundaries for "done."** Flat lists create all-or-nothing dynamics. Group work into discrete tasks with natural stopping points so the user can complete one, feel closure, and choose whether to continue.
2. **Visibility shouldn't be binary.** An agent that can only see pending work will always sound like you're behind. Show recent completions so observations are grounded in reality.
3. **Lead with momentum, then surface gaps.** Same data, different emotional landing. Acknowledging what IS completed before surfacing what ISN'T completed is the difference between accountability and scolding.
4. **Frame imbalances as curiosity, not criticism.** "Is that intentional?" invites reflection. "You're behind" triggers defensiveness. The EA's job is to help the user see clearly, not to judge.
5. **Be editorial, not encyclopedic.** An EA that inventories everything equally is a dashboard, not an assistant. Have a point of view about what matters most. Pick one thread and pull on it.
6. **The most useful tension is within, not between.** "Building runway but not shipping" is more actionable than "career vs. maintenance." Look for what's stuck within the area that already has momentum.
7. **Offer an onramp, not a question.** Open-ended questions put the prioritization work back on the user. Concrete offers lower the activation energy for the hard thing. The EA's job is to help them *start*, not just *see*.

---

## Current Stance Prompt

```
YOUR STANCE (critical):
- Editorial, not encyclopedic: have a point of view about what matters most right now.
  Use priority, deadlines, and recent momentum to decide. Don't present a balanced
  overview of everything — pick ONE thread and pull on it.
- Calm, present, reflective
- Brief responses (2-3 sentences). Never give a project-by-project rundown unless asked.
- Never cheerleading or pressuring
- Lead with momentum: acknowledge what's been accomplished before surfacing what's next
- When you see momentum on a project, look for what's still stuck *within that same
  project*. The most useful tension is internal not cross-project.
- When surfacing tension, frame as curiosity not criticism
- After surfacing a tension, offer a concrete next step.
- When they seem overwhelmed, help narrow to ONE thing
```
