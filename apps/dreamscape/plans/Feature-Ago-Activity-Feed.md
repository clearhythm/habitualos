# Feature: Ago — Full Activity Feed

## Vision

Ago is a personal journal, not a practice log. It shows your whole journey in reverse-chronological order: what you practiced, who joined your circle, what the AI helped you see, what chimes you received. The name implies looking back at everything — not just sessions.

No filters at launch. The feed earns filters when it's dense enough to need them. For now, mixed event types coexist in one elegant stream, visually distinct but clearly belonging together.

---

## Event Types

### 1. Practice
**Data source:** `sessions/{sessionId}` where `state: completed`

Displayed as:
- Practice name (serif, prominent)
- Duration — "12 minutes"
- Date/time (relative: "yesterday", "3 days ago")
- Note excerpt if present (italic, muted) — truncated with "read more" if long

```
Breathwork  ·  12 minutes  ·  yesterday
"Felt scattered at first, settled after a few rounds."
```

### 2. Reflect conversation
**Data source:** `reflect-chats/{chatId}`

Displayed as:
- Label: "Reflection"
- Opening message excerpt (first user message, or first assistant message)
- "View conversation →" link — opens the full message thread inline or on a detail page (TBD)
- Date/time

```
Reflection  ·  2 days ago
"I've been feeling overwhelmed lately…"
View conversation →
```

Note: full conversation view is deferred. The link can be a stub initially.

### 3. Social — circle join
**Data source:** `circle/{userId}` — when someone new joins (detect by `joinedAt` recency, or a dedicated `events` collection — see data model note below)

Displayed as:
- "{Name} joined your circle"
- Date/time

```
Circle  ·  4 days ago
Mia joined your circle.
```

### 4. Social — chime received
**Data source:** `notes/{noteId}` (or equivalent — check current chime/note data model)

Displayed as:
- "{Name} sent you a chime"
- Chime excerpt or type if available
- Date/time

```
Chime  ·  5 days ago
Jordan sent you a note.
```

---

## Data Model Note

Practice and reflect events have clear Firestore collections. Social events (join, chime) may need a lightweight `events/{eventId}` collection to make the feed queryable without joining multiple collections. Design options:

**Option A — Fan-out events collection**
Write an event doc whenever something happens (join, chime sent, etc.). Feed queries one collection sorted by `createdAt`. Clean but requires write discipline.

**Option B — Multi-collection fetch + merge**
On feed load, query sessions, reflect-chats, circle, notes separately, merge in JS, sort by date. Works at small scale. Gets messy as types grow.

Recommendation: start with **Option B** (simpler now), migrate to **Option A** if the fan-out gets unwieldy. The feed is personal (low volume per user), so the multi-fetch approach is fine for launch.

---

## Feed Design Principles

- Reverse-chronological, no grouping by day (dates are relative, not headers)
- Each event type has a distinct visual treatment but shares the same rhythm
- Practice: most prominent — name + duration + note
- Reflect: lighter — label + excerpt + link
- Social: simplest — one-line with name, no decoration
- Empty state: "Your journey begins here." — shown only when truly nothing exists
- No filters, no tabs at launch
- No pagination at launch — load all, cap at 100 items, add "load more" when needed

---

## What Changes to Ago

Current `history.njk` + `history.js` shows only sessions. This feature replaces that with a unified feed.

### Frontend
- `src/history.njk` — restructure feed items to support event types (add class variants)
- `src/assets/js/pages/history.js` — fetch from multiple sources, merge, render typed events
- `src/styles/_components.scss` — add `.feed-event`, `.feed-event--practice`, `.feed-event--reflect`, `.feed-event--social` styles

### Backend
- `netlify/functions/user-sessions.cjs` — already exists, returns practice sessions
- `netlify/functions/reflect-chats-get.cjs` — NEW: returns reflect-chats for a userId
- Social events — use existing circle/notes queries or introduce events collection (decide at build time)
- May want a unified `ago-feed.cjs` endpoint that assembles and sorts all event types server-side — cleaner than parallel fetches from the frontend

---

## Deferred

- Full reflect conversation view (inline thread or detail page)
- Filters / tabs by event type
- Pagination / infinite scroll
- Fan-out events collection (if Option B gets unwieldy)
- Chime playback from feed
