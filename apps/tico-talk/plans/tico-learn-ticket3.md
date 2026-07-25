# Ticket 3: /learn/ drill — "learned" persistence

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
  `increment`. Read the whole file — it's short.
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

## Overview

1. New Firestore service, `_services/db-learn-progress.cjs` — the first
   one in this app.
2. Wire `learn-tool-execute.cjs`'s `mark_section_learned` handler to
   actually call it (replacing Ticket 2's stub).
3. A real, distinct UI acknowledgment when a section is marked learned —
   not just another line in the transcript.
4. The picker screen reflects learned sections (so the "I've made
   progress" signal is visible beyond the moment it happens) — exact
   visual treatment (a checkmark/badge on the pill, re-coloring it, etc.)
   is a judgment call to make while implementing; keep it simple.

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

## Verification

1. `node --check` on `db-learn-progress.cjs` and the modified
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
     confirm `learn-progress/{userId}` now has `{sectionName: true}`.
   - Navigate back to the picker (via the existing back link) — confirm
     that section's pill now shows the learned badge.
   - Refresh the page entirely, go back to `/learn/` — confirm the badge
     persists (this is testing the localStorage mirror specifically,
     independent of the Firestore write actually succeeding).

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
