# Ticket 3: /learn/ drill — conversation & progress persistence

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). Backend:
Netlify Functions (Node.js CommonJS — top-level function files use the
`.cjs` extension because `package.json` has `"type": "module"`). Database:
Google Firestore via `@habitualos/db-core`, a thin CRUD wrapper package
already a dependency of this app. No auth system exists — there's no
concept of a signed-in user anywhere in tico-talk; "userId" here just
means a stable anonymous identifier generated client-side and stored in
localStorage (the established convention across HabitualOS apps that
don't have full accounts, e.g. `apps/obi-wai-web`).

**Depends on Ticket 2** — specifically:
- The `mark_section_learned` tool must already exist and fire correctly
  (Ticket 2's `netlify/functions/learn-tool-execute.cjs` has a stub
  branch for it that just returns `{ result: { learned: true } }` without
  persisting anything — this ticket replaces that stub with a real write).
- `src/assets/js/utils/user-id.js`'s `getOrCreateUserId()` already exists
  (built in Ticket 2, since the streaming core requires a valid userId to
  function at all, independent of persistence). This ticket does not
  create a new userId helper — it reuses that one.

## Phase 0: Explore First

- `packages/db-core/db-core.cjs` — the full CRUD API in this monorepo:
  `create({collection, id?, data})` (upserts — merges if the doc already
  exists, per its own docstring), `get({collection, id})`,
  `query({collection, where, orderBy, limit})`, `patch`, `remove`,
  `increment`, `uniqueId(prefix)`. Read the whole file — it's short.
- `packages/db-core/firestore.cjs` — confirms the exact env var name
  Firestore credentials must use: `FIREBASE_ADMIN_CREDENTIALS`.
- `apps/obi-wai-web/netlify/functions/_services/db-practice-logs.cjs` —
  the closest existing example of this monorepo's `_services/` pattern
  (a thin wrapper module around `dbCore` calls, one file per concern).
  **tico-talk has no `_services/` directory yet — this ticket creates the
  first one.**
- `apps/tico-talk/netlify/functions/learn-tool-execute.cjs` (from Ticket
  2) — find the `mark_section_learned` branch; this ticket replaces its
  body.
- `apps/tico-talk/src/assets/js/utils/user-id.js` (from Ticket 2) — the
  existing `getOrCreateUserId()` this ticket's frontend piece calls.
- `apps/tico-talk/src/learn.njk` and `src/assets/js/learn.js` (from
  Tickets 1 & 2) — find where the picker pills are rendered
  (`data-section="..."` attributes) and where the "learned"
  acknowledgment currently renders as a plain transcript line (Ticket 2's
  `if (learned) { appendLine(...) }` block) — this ticket adds a more
  distinct visual treatment there and updates the picker to reflect
  learned sections.
- **This ticket's second half is adapted closely from a real, working
  example — read it in full before writing anything:**
  `apps/dreamscape/src/assets/js/pages/reflect.js` (the `persistChat` /
  `flushPendingSave` / TTL-abandonment logic near the top and bottom of
  the file), `apps/dreamscape/src/assets/js/collections/reflect-chats.js`
  (the client wrapper: `saveReflectChatBeacon`, `saveReflectChat`,
  `getReflectChat`), and `apps/dreamscape/netlify/functions/
  collections/reflect-chats.cjs` +
  `apps/dreamscape/netlify/functions/reflect-chat-save.cjs` +
  `reflect-chat-get.cjs` (the backend collection module + thin endpoint
  wrappers). This ticket copies that architecture's *shape*, not its
  code verbatim (tico-talk doesn't have dreamscape's `_utils/api.cjs`
  `handle()` wrapper — write plain `exports.handler` functions matching
  this app's existing convention, e.g. `learn-drill.cjs`/
  `learn-chat-init.cjs`).

## Overview

This ticket has two persistence concerns that share one Firestore
prerequisite but serve different purposes — build both:

**A. `learn-progress` — the mastery flag** (as originally scoped)
1. New Firestore service, `_services/db-learn-progress.cjs` — the first
   one in this app. A flat `{sectionName: true, ...}` map per user.
2. Wire `learn-tool-execute.cjs`'s `mark_section_learned` handler to
   actually call it (replacing Ticket 2's stub).
3. A real, distinct UI acknowledgment when a section is marked learned —
   not just another line in the transcript.
4. The picker screen reflects learned sections (so the "I've made
   progress" signal is visible beyond the moment it happens) — exact
   visual treatment (a checkmark/badge on the pill, re-coloring it, etc.)
   is a judgment call to make while implementing; keep it simple.

**B. `learn-chats` — the full conversation log** (new scope, added after
design discussion; see "Why boundary-triggered, not per-turn" below)
5. New Firestore collection + service, `_services/db-learn-chats.cjs` —
   one doc per section-drill "chat life" (from first turn until it's
   flushed), storing the full `messages` array plus an `action`
   classifying why it was saved: `'learned'`, `'exited'`, or `'abandoned'`.
   This is what answers "what is actually getting practiced" — distinct
   from `learn-progress`'s single boolean per section.
6. Two new endpoints, `learn-chat-save.cjs` and `learn-chat-get.cjs`
   (the latter only for the load-time verify/retry safety net), plus a
   client-side collection wrapper `src/assets/js/collections/
   learn-chats.js` — all three mirroring dreamscape's reflect-chats
   architecture referenced above.
7. Ticket 2's `learn.js` (its persistence section, added in that ticket)
   calls into this wrapper at three boundaries — see "Why
   boundary-triggered, not per-turn" below for what those are and why.

**Why boundary-triggered, not per-turn**: writing to Firestore on every
single turn (as originally sketched in discussion before this ticket was
written) would mean one write per exchange, indefinitely, for as long as
someone drills a section — needless load for data nobody's reading turn
by turn. Dreamscape's reflect chat solves this the same way: every turn
writes to localStorage only (instant, free), and Firestore is only
touched at a small number of meaningful *boundaries* — an explicit user
action, a natural resolution, or a detected abandonment. Reuse that same
model here instead of re-deriving it:
- **`'learned'`** — `mark_section_learned` fires (Ticket 2's tool-complete
  event). The full transcript that led to that moment is worth keeping.
- **`'exited'`** — the user clicks "Choose a different section" (the
  `.learn-back` link) while a section's chat has real content. Save via
  `sendBeacon` since this coincides with navigating away.
- **`'abandoned'`** — on next page load, Ticket 2's TTL check (24h) finds
  a stale persisted chat with real user content. Flush it (fetch is fine
  here — no navigation race, the tab is just loading) before clearing it.

Each of these is also the point where the locally-persisted section chat
gets cleared — a "chat life" ends when it's saved, same as reflect.js's
`clearHistory()` immediately following each `persistChat()` call on its
equivalent paths.

## File 1: `netlify/functions/_services/db-learn-progress.cjs` (NEW)

Data shape: one Firestore document per user in a `learn-progress`
collection, with section names as keys mapped to `true`. This is
deliberately the simplest possible shape — a flat map, not a subcollection
or an array — since the only thing being tracked right now is a boolean
per section, no timestamps or attempt history (add those later if a real
need for them shows up; don't build it preemptively).

```javascript
//
// netlify/functions/_services/db-learn-progress.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Progress) for Firestore.
// Tracks which menu/drink sections a user has been judged to have
// learned during /learn/ drilling.
//
// Schema:
//   learn-progress/{userId}
//   {
//     "Starters": true,
//     "Soup & Salad": true,
//     ...
//     _updatedAt: Firestore timestamp (set automatically by db-core)
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'learn-progress';

/**
 * Get a user's full learn-progress doc.
 * @param {string} userId
 * @returns {Promise<Object|null>} the doc, or null if the user has no progress yet
 */
exports.getLearnProgress = async (userId) => {
  return dbCore.get({ collection: COLLECTION, id: userId });
};

/**
 * Mark one section as learned for a user. Upserts — safe to call whether
 * or not the user has an existing doc yet (dbCore.create merges if the
 * doc already exists, per its own docstring).
 * @param {string} userId
 * @param {string} sectionName
 * @returns {Promise<Object>} { id }
 */
exports.markSectionLearned = async (userId, sectionName) => {
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [sectionName]: true }
  });
};
```

Note: `db-core`'s `sanitize()` (used internally for collection/doc IDs,
not field names — confirmed by reading `db-core.cjs`) only allows
letters/numbers/dash/underscore for the **id**, which here is `userId`
(already in the safe `u-xxxxxxxx` format) — not a concern. Field names
(the section name keys, e.g. `"Soup & Salad"`) are stored as literal
Firestore field names and are **not** sanitized by db-core, so
`"Soup & Salad"` works fine as a key exactly as-is (same reasoning
already established elsewhere in this app for dot-notation field names).

## File 2: `netlify/functions/learn-tool-execute.cjs` (MODIFY)

Find the `mark_section_learned` branch (currently a stub from Ticket 2)
and replace it:

```javascript
// Before (Ticket 2's stub):
if (toolUse.name === 'mark_section_learned') {
  // TODO (Ticket 3): write to the learn-progress Firestore collection.
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: { learned: true } })
  };
}

// After:
if (toolUse.name === 'mark_section_learned') {
  if (!section) {
    return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
  }
  await markSectionLearned(userId, section);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: { learned: true, section } })
  };
}
```

This requires two things the stub didn't need:
- Import the service at the top of the file:
  ```javascript
  const { markSectionLearned } = require('./_services/db-learn-progress.cjs');
  ```
- `userId` and `section` need to actually reach this function. Check
  `chat-stream-core.ts` (from Ticket 2) — the tool-execute request body
  it sends is `{ userId, toolUse: {id, name, input} }`, **no `section`**.
  Since `mark_section_learned`'s `input_schema` (defined in Ticket 2's
  `learn-chat-init.cjs`) currently takes no parameters, the model has no
  way to tell this endpoint which section it was drilling. Two ways to
  fix this, pick one while implementing:
  - (a) Add a `section` property to the tool's `input_schema` and have
    the model pass it back explicitly when calling the tool (requires
    updating the tool description in Ticket 2's file to ask for it).
  - (b) Extend `chat-stream-core.ts`'s tool-execute request body (the
    same file already customized once in Ticket 2 to add `section` to
    `initBody`) to also include `body.section` in `toolBody`, so it
    arrives without relying on the model to echo it back correctly.
  (b) is more reliable (doesn't depend on the model getting a parameter
  right) and is a small, consistent extension of the exact same pattern
  already used for `initBody` — recommended, but note the tradeoff either
  way while implementing.

## File 3: `src/assets/js/learn.js` (MODIFY)

Replace Ticket 2's placeholder "learned" handling:

```javascript
// Before (Ticket 2):
if (learned) {
  // Ticket 3 replaces this with a real, distinct visual treatment.
  appendLine('tico-aside', 'You’ve got this section down — nice work.');
}
```

With a real, visually distinct acknowledgment — not another transcript
line. Exact treatment is a judgment call; a reasonable starting point:

```javascript
if (learned) {
  showLearnedBanner();
}
```

```javascript
function showLearnedBanner() {
  const banner = document.createElement('div');
  banner.className = 'learn-learned-banner';
  banner.textContent = `You've learned ${currentSection}!`;
  transcript.parentElement.insertBefore(banner, transcript.nextSibling);
  banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
```

Also update `localStorage` so the picker screen (see File 5) can reflect
learned sections without a network round-trip on every page load — mirror
the Firestore write client-side:

```javascript
function markSectionLearnedLocally(sectionName) {
  try {
    const learned = JSON.parse(localStorage.getItem('tico-learned-sections') || '{}');
    learned[sectionName] = true;
    localStorage.setItem('tico-learned-sections', JSON.stringify(learned));
  } catch {
    // non-fatal — the picker just won't show the badge until next real fetch
  }
}
```
Call this alongside `showLearnedBanner()` when `learned` is true.

## File 4: `src/styles/_learn.scss` (MODIFY)

Add styling for the banner — should read as a genuine, positive moment,
not blend into the transcript:

```scss
.learn-learned-banner {
  text-align: center;
  padding: $space-md;
  margin: $space-md $space-lg 0;
  background: color-mix(in srgb, $color-success 12%, transparent);
  border: 1px solid $color-success;
  border-radius: 0.75rem;
  color: $color-text;
  font-weight: 600;
}
```

(`$color-success` already exists in `src/styles/_variables.scss` — check
it resolves to something reasonable for this use; if it's an unrelated
color for this context, use `$color-green` instead, which is this app's
established positive/primary color.)

## File 5: `src/learn.njk` (MODIFY)

Find the picker pills (`<button class="competency-pill" data-section="{{ category.name }}">`).
Add a way to visually mark ones already learned — this needs the learned
sections available at render time. Since there's no server-side session
concept, this has to be a client-side enhancement after page load, not
something Nunjucks can render directly:

Add a small script (in `src/assets/js/learn.js`, near the top, run on
page load) that reads `localStorage['tico-learned-sections']` and adds a
class to matching pills:

```javascript
function applyLearnedBadges() {
  let learned = {};
  try {
    learned = JSON.parse(localStorage.getItem('tico-learned-sections') || '{}');
  } catch {}
  document.querySelectorAll('.learn-picker .competency-pill').forEach((pill) => {
    if (learned[pill.dataset.section]) {
      pill.classList.add('competency-pill--learned');
    }
  });
}
applyLearnedBadges();
```

Add a small CSS modifier in `_learn.scss` (or `_competency-select.scss`,
wherever `.competency-pill`'s base rule lives — check before adding, to
place this near the class it modifies):

```scss
.competency-pill--learned {
  border-color: $color-green;

  &::after {
    content: ' ✓';
    color: $color-green;
  }
}
```

This is intentionally the simplest possible version — a checkmark
suffix, not a redesigned pill. Refine visually later once it's clear this
is the right signal to show at all.

## File 6: `netlify/functions/_services/db-learn-chats.cjs` (NEW)

Mirrors `apps/dreamscape/netlify/functions/collections/reflect-chats.cjs`,
adapted: `practiceName`/`practiceDuration` become `section`, and the
`action` enum is `'learned' | 'exited' | 'abandoned'` instead of
`'practice' | 'non-practice' | 'abandoned'`.

```javascript
//
// netlify/functions/_services/db-learn-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Chats) for Firestore.
// Full conversation log for /learn/ drill sessions — distinct from
// db-learn-progress.cjs's boolean mastery flag. One doc per section-drill
// "chat life," saved at a boundary (learned / exited / abandoned), not
// per turn. See "Why boundary-triggered, not per-turn" above.
//
// Schema:
//   learn-chats/{chatId}
//   {
//     _chatId, _userId, section,
//     messages: [{role, content, timestamp}, ...],
//     action: 'learned' | 'exited' | 'abandoned',
//     conversationStart: Firestore timestamp,
//     conversationEnd: Firestore timestamp,
//   }
// ------------------------------------------------------

const { create, get, uniqueId, Timestamp } = require('@habitualos/db-core');

const COLLECTION = 'learn-chats';

function toTimestamp(iso) {
  if (!iso) return null;
  try { return Timestamp.fromDate(new Date(iso)); } catch { return null; }
}

/**
 * Save (upsert) a learn chat. If chatId is provided (client-generated,
 * the normal case — see collections/learn-chats.js), uses it so repeat
 * saves for the same "chat life" overwrite rather than duplicate.
 * @returns {Promise<{chatId: string}>}
 */
exports.saveLearnChat = async ({ chatId, userId, section, messages, action, conversationStart, conversationEnd }) => {
  const id = chatId || uniqueId('lc');
  await create({
    collection: COLLECTION,
    id,
    data: {
      _chatId: id,
      _userId: userId,
      section,
      messages,
      action,
      conversationStart: toTimestamp(conversationStart),
      conversationEnd: toTimestamp(conversationEnd),
    }
  });
  return { chatId: id };
};

/**
 * Fetch one chat by ID, validating ownership — used by the load-time
 * verify/retry safety net (learn-chat-get.cjs), same as reflect-chats.
 * @returns {Promise<Object|null>}
 */
exports.getLearnChat = async (chatId, userId) => {
  const doc = await get({ collection: COLLECTION, id: chatId });
  if (!doc || doc._userId !== userId) return null;
  return doc;
};
```

Confirm `uniqueId`/`Timestamp` are both exported from
`@habitualos/db-core`'s top-level index while implementing (dreamscape's
`reflect-chats.cjs` imports them the same way, from the same package, so
they should already be available here — just verify, don't assume).

## File 7: `netlify/functions/learn-chat-save.cjs` (NEW)

```javascript
const { saveLearnChat } = require('./_services/db-learn-chats.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { chatId, userId, section, messages, action, conversationStart, conversationEnd } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    if (!section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    if (!Array.isArray(messages)) return { statusCode: 400, body: JSON.stringify({ error: 'messages array is required' }) };
    if (!action) return { statusCode: 400, body: JSON.stringify({ error: 'action is required' }) };

    const { chatId: savedId } = await saveLearnChat({ chatId, userId, section, messages, action, conversationStart, conversationEnd });
    log('debug', '[learn-chat-save] saved', savedId, 'action:', action, 'section:', section);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, chatId: savedId }) };
  } catch (error) {
    log('error', '[learn-chat-save] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

This endpoint gets called via `sendBeacon` for the `'exited'` path (see
Ticket 2), which POSTs a `Blob` with no custom headers — Netlify
functions read the raw body regardless of `Content-Type`, and
dreamscape's identical `reflect-chat-save.cjs` already relies on this
working, but confirm while testing rather than assuming.

## File 8: `netlify/functions/learn-chat-get.cjs` (NEW)

Only exists for the load-time verify/retry safety net (mirrors
dreamscape's `flushPendingSave`) — confirms a `sendBeacon`-based save
from a previous visit actually landed, so a silently-dropped beacon
doesn't just lose that transcript forever.

```javascript
const { getLearnChat } = require('./_services/db-learn-chats.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { chatId, userId } = event.queryStringParameters || {};
  if (!chatId) return { statusCode: 400, body: JSON.stringify({ error: 'chatId is required' }) };
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };

  const chat = await getLearnChat(chatId, userId);
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: !!chat }) };
};
```

## File 9: `src/assets/js/collections/learn-chats.js` (NEW)

Client wrapper — the network calls Ticket 2's `learn.js` persistence
logic calls into. Mirrors `apps/dreamscape/src/assets/js/collections/
reflect-chats.js` almost exactly; tico-talk doesn't have dreamscape's
shared `api.js` `post`/`get` helpers, so this uses plain `fetch`.

```javascript
/**
 * saveLearnChatBeacon — fire-and-forget via sendBeacon.
 * Returns true if the browser accepted the request, false otherwise.
 * Use for pre-navigation saves (the 'exited' path — leaving the drill).
 */
export function saveLearnChatBeacon({ chatId, userId, section, messages, action, conversationStart, conversationEnd }) {
  const payload = JSON.stringify({ chatId, userId, section, messages, action, conversationStart, conversationEnd });
  return navigator.sendBeacon('/api/learn-chat-save', new Blob([payload], { type: 'application/json' }));
}

/**
 * saveLearnChat — async fetch with a response.
 * Use for saves where the tab is staying open ('learned', TTL-driven
 * 'abandoned' flush on load).
 */
export async function saveLearnChat({ chatId, userId, section, messages, action, conversationStart, conversationEnd }) {
  const response = await fetch('/api/learn-chat-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, userId, section, messages, action, conversationStart, conversationEnd })
  });
  return response.json();
}

/**
 * getLearnChat — check whether a specific chatId was actually saved.
 * Used only by the load-time verify/retry safety net.
 */
export async function getLearnChat(chatId, userId) {
  const response = await fetch(`/api/learn-chat-get?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`);
  return response.json();
}
```

## Verification

1. `node --check` on `db-learn-progress.cjs`, `db-learn-chats.cjs`,
   `learn-chat-save.cjs`, `learn-chat-get.cjs`, and the modified
   `learn-tool-execute.cjs`/`learn.js`.
2. `sass` compile.
3. **Requires both Ticket 2's `ANTHROPIC_API_KEY` and this ticket's own
   Firestore prerequisite (below) to live-test.** With both in place, via
   `netlify dev`:
   - Drill a section until `mark_section_learned` fires (per Ticket 2,
     this is a model judgment call, so the exact number of rounds varies
     — that's expected).
   - Confirm the distinct banner appears (not just a transcript line).
   - Check Firestore directly (console, or a quick `dbCore.get` call) —
     confirm `learn-progress/{userId}` now has `{sectionName: true}`, and
     `learn-chats/{chatId}` has a doc with `action: 'learned'` and the
     full `messages` array.
   - Navigate back to the picker (via the existing back link) — confirm
     that section's pill now shows the learned badge.
   - Refresh the page entirely, go back to `/learn/` — confirm the badge
     persists (this is testing the localStorage mirror specifically,
     independent of the Firestore write actually succeeding).
4. **`'exited'` boundary**: start a section, answer at least once (so
   `chatHistory` has real content), then click "Choose a different
   section" *before* `mark_section_learned` fires. Confirm (via the
   Network tab, since this fires through `sendBeacon` and won't show a
   normal response) that a `learn-chats` doc was created with
   `action: 'exited'`, and that re-entering the same section afterward
   starts a fresh drill rather than resuming the exited one (the local
   copy should have been cleared).
5. **`'abandoned'` boundary**: start a section, answer at least once,
   then manually back-date the persisted localStorage timestamp past the
   24h TTL (or temporarily shrink `TTL_MS` while testing) and reload.
   Confirm a `learn-chats` doc lands with `action: 'abandoned'` and the
   local copy is cleared — without needing to interact with the drill at
   all after reload.

## Prerequisite (interactive — needs Erik, blocks live testing only)

A new, dedicated Firestore project for tico-talk — not reusing another
app's:
1. Create a new Firebase/Firestore project for tico-talk (Firebase
   console), and generate a service-account credentials JSON for it.
2. Add the credentials to `apps/tico-talk/.env` as
   `FIREBASE_ADMIN_CREDENTIALS=...` (the exact env var name
   `packages/db-core/firestore.cjs` expects — confirm by reading that
   file). Don't paste the raw JSON into chat; just confirm once it's
   added.
3. For an eventual real deploy, the same var needs to be set in Netlify's
   site config too (not just local `.env`) — noting this now so it isn't
   a surprise later; not something to do yet.

The code in this ticket can be written and reviewed without this — it
only blocks the live Firestore-write verification steps above.
