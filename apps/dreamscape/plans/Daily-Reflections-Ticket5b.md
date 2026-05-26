# Feature: Canonical Practice Naming in go_to_practice

## Problem

The `go_to_practice` tool currently generates descriptive names like "Inner Child LASSO" or "Heart Meditation". These are hard to aggregate — the practice history and future stats view ("how many times have I done X") depend on consistent, reusable names. A user who says "I want to do LASSO" three different ways should accumulate 3 LASSO sessions, not 3 differently-named ones.

## Desired Behavior

When the AI calls `go_to_practice`, the `practiceName` should be:

1. **Pulled from the user's existing practice history** if something close matches. If the user has sessions with `practiceName: "LASSO"` and they say "I want to do a LASSO breath meditation on inner child", the tool should return `"LASSO"`, not `"Inner Child LASSO Breathwork"`.

2. **A short canonical name (1–2 words max)** if no existing match. Category-level, not session-level. "Meditation" not "Morning Clarity Meditation". "Breathwork" not "Box Breathing Technique". "Yoga" not "Gentle Flow Yoga".

## Data Model

### `practices/{practiceId}` collection

Mirrors the obi-wai-web approach. One document per user+practice combination, incremented on each session completion.

```
practices/{practiceId}
  _userId:         string         // owner
  name:            string         // canonical practice name, e.g. "LASSO", "Meditation"
  count:           number         // total sessions completed
  lastPracticedAt: ISO string     // for sorting / recency
  createdAt:       ISO string
```

**Why not query sessions?** Sessions give you raw history but require a full scan + JS dedup to get distinct names + counts. The `practices` collection is a pre-aggregated index — one query returns everything the AI and the UI need. `db-core` has `increment()` which makes the count update atomic.

### When to write/increment

In `session-complete.cjs` (the endpoint called when a practice session ends), after writing the session doc:

```javascript
// Upsert the practices index
const existing = await query({
  collection: 'practices',
  where: [`_userId::eq::${userId}`, `name::eq::${practiceName}`],
});

if (existing.length > 0) {
  await increment({
    collection: 'practices',
    id: existing[0]._id,
    field: 'count',
    by: 1,
  });
  await patch({ collection: 'practices', id: existing[0]._id,
    data: { lastPracticedAt: new Date().toISOString() } });
} else {
  await create({ collection: 'practices', id: uniqueId('pr'), data: {
    _userId: userId,
    name: practiceName,
    count: 1,
    lastPracticedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }});
}
```

---

## Implementation

### Where to change

- **`netlify/functions/session-complete.cjs`** — increment/create practices doc on completion
- **`netlify/functions/reflect-chat-init.cjs`** — system prompt: pass user's practice list to AI
- **`netlify/functions/reflect-tool-execute.cjs`** — optional safety-net name normalization

### Step 1 — Feed practice list into the system prompt

In `reflect-chat-init.cjs`, query the `practices` collection for this user before building the system prompt:

```javascript
const userPractices = await query({
  collection: 'practices',
  where: [`_userId::eq::${userId}`],
});
const practiceNames = userPractices
  .sort((a, b) => b.count - a.count)  // most-used first
  .map(p => p.name);
```

Pass into the system prompt:

```
The user's existing practices (most used first): ${practiceNames.join(', ') || 'none yet'}.
When calling go_to_practice, reuse one of these exact names if the practice matches.
If the user is trying something genuinely new, choose a short canonical category name (1–2 words, no descriptors).
Examples: "Meditation", "Breathwork", "LASSO", "Yoga", "Journaling", "Walking".
Avoid compound or descriptive names like "Inner Child LASSO" or "Morning Heart Meditation".
```

### Step 2 — Safety-net normalization in tool-execute (optional)

After the AI returns a `practiceName`, do a simple case-insensitive match against the user's existing names. If it matches closely enough, replace with the canonical version:

```javascript
const match = practiceNames.find(p =>
  p.toLowerCase() === practiceName.toLowerCase() ||
  practiceName.toLowerCase().includes(p.toLowerCase()) ||
  p.toLowerCase().includes(practiceName.toLowerCase())
);
if (match) practiceName = match;
```

No fuzzy-match library — simple substring is enough for this use case.

## Relationship to Ago Feed

Canonical names are what make the Ago feed's practice stats meaningful. The "how many times have I done X" view (planned in `Feature-Ago-Activity-Feed.md`) depends entirely on `practiceName` being consistent across sessions. This change is a prerequisite for that feature to be useful.

## Notes

- Existing sessions with inconsistent names are already in the DB — this only affects new sessions going forward. No migration needed at launch.
- If the user's practice list grows long, consider capping the list passed to the system prompt (e.g., top 10 most recent distinct names) to avoid bloating the context.

## Untimed Logging

Untimed practice logs (see `Feature-Ago-Activity-Feed.md` — "Log untimed" link) should route through `session-complete.cjs` with `durationSeconds: null` (or `0`). The practices increment logic must not gate on duration being present — an untimed session is still a session and should count toward `practices.count`.

Ensure `session-complete.cjs` handles `durationSeconds: null` gracefully throughout (session write, practices upsert, any post-practice logic). Do not create a separate endpoint for untimed logs — keeping one completion path means the practices index stays accurate regardless of how the session was logged.
