# EA Stance & Context Design: Fox-EA System Prompt Evolution

**Date:** 2026-02-13
**System:** HabitualOS (executive assistant agent)
**Feature:** Fox-EA — conversational executive assistant with project/action visibility
**File:** `apps/habitual-web/netlify/functions/fox-ea-chat-init.js`

---

## Context

Fox-EA is an executive assistant agent that sees the user's projects, open actions, active agents, and recent work. It opens conversations with observations about what it sees and helps the user prioritize. The system prompt is built dynamically at chat init from live DB state — it's not static text, it's a snapshot of the user's world.

---

## Problem 1: Flat Review Dump

**Before:** All pending drafts from all agents were dumped into the system prompt as a flat list. All open review action IDs were listed separately. No connection between which drafts belonged to which action.

**What happened:** If discovery ran twice, all pending drafts piled up. Fox-EA couldn't tell which action covered which batch. User couldn't complete one review action and stop — it was all-or-nothing.

**Fix:** Store `draftIds` array on each review action's `taskConfig` at creation time (in `discovery-pipeline.cjs`). Restructure the system prompt to group drafts by their parent action:

```
== REVIEW TASKS ==

TASK 1 (action-abc123): Review 5 new company recommendations
Items: [draft data for those 5...]

TASK 2 (action-def456): Review 3 new company recommendations
Items: [draft data for those 3...]
```

Instruct Fox-EA to work one task at a time, complete the action when done, then offer to continue.

**Principle:** *Link data to its container. Flat lists lose provenance — grouping by action gives the agent (and user) clear boundaries for "done."*

---

## Problem 2: Completable Actions Invisible

**Before:** The `complete_review_action` tool was only included when `pendingDrafts.length > 0`. But when all drafts in an action are already reviewed, pending count is zero — so the tool disappeared exactly when it was needed.

**What happened:** Fox-EA couldn't close review actions that had all drafts reviewed. Actions stayed open forever.

**Fix:** Introduced `hasReviewWork` flag that's true when there are either review tasks with pending drafts OR completable actions (all drafts reviewed, action still open). Gate the `complete_review_action` tool on `hasReviewWork` instead of `pendingDrafts.length > 0`. Added a "COMPLETED TASKS TO CLOSE" section in the prompt instructing Fox-EA to close these immediately at conversation start.

**Principle:** *Tool availability must match the work state, not the data state. "No pending drafts" doesn't mean "no review work" — it might mean the work is done and needs to be recorded as done.*

---

## Problem 3: Completed Actions Vanish

**Before:** The system prompt only showed "Open Actions" — filtered to states `open`, `defined`, `scheduled`, `in_progress`. When an action was completed, it simply disappeared from Fox-EA's view. No trace.

**What happened:** Fox-EA told the user "your Career Launch has 6 open actions but minimal recent movement" — ignoring that 2 career-related review actions had just been completed. The EA had no way to know about recent completions.

**Fix:** Added "Recently Completed" section showing actions completed in the last 7 days:

```
Recently Completed:
- Review 5 company recommendations (Scout Agent) — completed
- Review 3 company recommendations (Scout Agent) — completed
```

Uses `completedAt` timestamp (set by `updateActionState` when transitioning to `completed`). Handles both Firestore Timestamps (`.toDate()`) and ISO strings. Section only appears when there are recent completions.

**Principle:** *Visibility shouldn't be binary (open vs. gone). Recently completed work is context the EA needs to give accurate observations. A 7-day window is enough to honor recent momentum without cluttering the view.*

---

## Problem 4: Leading with Gaps Instead of Momentum

**Before:** The stance instructions said:
- "Help the user notice patterns they might miss"
- "Never cheerleading or pressuring"

**What happened:** Fox-EA interpreted "patterns they might miss" as "point out what's not happening." Combined with seeing open actions but not recently completed ones, it opened with criticism:

> "Your recent work has been heavily skewed toward Life Maintenance while Career Launch has 6 open actions but minimal recent movement on the high-priority ones."

This landed as scolding. The user had just completed career-related review actions, but the EA didn't know — and even after seeing the data, it led with the gap rather than acknowledging the momentum.

**Fix:** Added two stance instructions:

```
- Lead with momentum: acknowledge what's moving and recently completed before surfacing gaps
- When observing imbalances, frame as curiosity not criticism: "I notice X has been active while Y is waiting — is that intentional?" rather than implying they're behind
```

**Principle:** *Observation order matters. "You've been making career moves — what about X?" lands completely differently from "X is stalled." Same information, different framing. The EA should acknowledge what IS before surfacing what ISN'T. And imbalances should be surfaced as questions ("is that intentional?") not judgments ("you're behind").*

---

## Problem 5: Multi-Tool-Use Streaming Bug

**Before:** `chat-stream-core.ts` used `.find()` to get the first `tool_use` block from Claude's response. When Claude returned multiple tool calls in one turn, only the first got a `tool_result`.

**What happened:** Claude's next API call included tool_use blocks without corresponding tool_result blocks, causing a 400 error: `tool_use ids were found that do not have tool_result blocks`. The chat stream hung.

**Fix:** Changed `.find()` to `.filter()` to process ALL tool_use blocks. Loop through each, execute the tool, collect results, and send them all back as a single `user` message with multiple `tool_result` content blocks.

**Principle:** *Always handle the plural case. If an API can return multiple items (tool calls, content blocks, etc.), processing only the first is a time bomb. The single-item case works fine; the multi-item case silently breaks.*

---

## Problem 6: Tool Status Indicators Wiped During Streaming

**Before:** Tool status messages ("Using submit_draft_review... ✓ submit_draft_review") were injected into the streaming message element's innerHTML. But `appendStreamingText()` overwrote innerHTML on every token, and `finalizeStreamingMessage()` re-rendered from just `streamingText`.

**What happened:** Tool status indicators would flash briefly then disappear as new tokens arrived.

**Fix:** Track tool events in a separate `streamingToolEvents` array. New `renderStreamingContent()` function combines tool event HTML + markdown content + cursor on every render. Finalize preserves tool events in the final HTML.

**Principle:** *Streaming content and metadata need separate state. If you mix them into one string/element, any re-render from the content source will wipe the metadata. Keep parallel tracks and compose at render time.*

---

## Abstracted Principles

1. **Link data to its container.** Flat lists lose provenance. Group by parent entity to give clear "done" boundaries.
2. **Tool availability must match work state, not data state.** "No pending items" might mean "work is done and needs closing," not "no work exists."
3. **Visibility shouldn't be binary.** Recently completed work is active context. A sliding window (7 days) honors momentum without clutter.
4. **Observation order matters.** Acknowledge what IS before surfacing what ISN'T. Same data, different emotional landing.
5. **Frame imbalances as curiosity, not criticism.** "Is that intentional?" vs "you're behind." The EA's job is to help the user see clearly, not to judge.
6. **Always handle the plural case.** If an API can return N items, processing only item[0] is a time bomb.
7. **Streaming content and metadata need separate state.** Mix them and any content re-render wipes the metadata. Compose at render time from parallel tracks.

---

## Files Modified

- `apps/habitual-web/netlify/functions/_utils/discovery-pipeline.cjs` — store `draftIds` on review action taskConfig
- `apps/habitual-web/netlify/functions/fox-ea-chat-init.js` — action-grouped review prompt, recently completed section, stance tuning
- `packages/edge-functions/chat-stream-core.ts` — multi-tool-use fix (`.find()` → `.filter()`)
- `apps/habitual-web/src/do/chat.njk` — tool status indicator persistence
- `apps/habitual-web/netlify/functions/fox-ea-tool-execute.js` — handles `complete_review_action` tool calls
