# TICKET-1: Shared Plumbing — `@habitualos/web-search` + `signal-contacts` Firestore Service

## Why this exists

Two pieces of infrastructure that every network ticket depends on, neither of which has any product logic in it:

1. **`@habitualos/web-search`** — Tavily search is currently copy-pasted into `habitual-web`. Rather than duplicate it again in Signal, extract it into a shared monorepo package so any app can `require('@habitualos/web-search')`. Pure extraction — behavior unchanged.

2. **`db-signal-contacts.cjs`** — The `signal-contacts` Firestore collection needs a service layer before any endpoint can write to it. This is the same CRUD pattern as every other `db-signal-*.cjs` service in the app.

No scoring logic, no AI calls, no UI. Run this first so every subsequent ticket has its dependencies in place.

This is TICKET-1 of 7. All subsequent network tickets depend on this one.
TICKET-1b covers person fit scoring and must run after this one.

---

## Part A: `@habitualos/web-search` Package

### Read first
- `/Users/erik/Sites/habitualos/apps/habitual-web/netlify/functions/_utils/discovery-pipeline.cjs` — contains the `tavilySearch()` function to extract (lines 34–60)
- `/Users/erik/Sites/habitualos/apps/habitual-web/netlify/functions/_utils/article-pipeline.cjs` — also uses Tavily inline; update to import from package after creating it
- `/Users/erik/Sites/habitualos/pnpm-workspace.yaml` — verify `packages/*` is in the workspace globs

### Create `packages/web-search/package.json`
```json
{
  "name": "@habitualos/web-search",
  "version": "1.0.0",
  "main": "index.cjs",
  "license": "UNLICENSED",
  "private": true
}
```

### Create `packages/web-search/index.cjs`
Extract `tavilySearch` from `discovery-pipeline.cjs` and generalize it:

```js
'use strict';

/**
 * @habitualos/web-search
 * Shared Tavily web search client for HabitualOS apps.
 */

/**
 * Search the web via Tavily API.
 * @param {string} query
 * @param {object} options
 * @param {number} [options.maxResults=10]
 * @param {boolean} [options.includeRawContent=false]
 * @param {string} [options.searchDepth='basic'] 'basic' or 'advanced'
 * @returns {Promise<Array<{title, url, content?, score?}>>}
 */
async function tavilySearch(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const { maxResults = 10, includeRawContent = false, searchDepth = 'basic' } = options;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_raw_content: includeRawContent,
      search_depth: searchDepth,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error: ${response.status} — ${text}`);
  }

  const data = await response.json();
  return data.results || [];
}

module.exports = { tavilySearch };
```

### Update `apps/habitual-web/package.json`
Add to dependencies:
```json
"@habitualos/web-search": "workspace:*"
```

### Refactor `apps/habitual-web/netlify/functions/_utils/discovery-pipeline.cjs`
Replace the inline `tavilySearch` function with:
```js
const { tavilySearch } = require('@habitualos/web-search');
```
Remove the local function definition. Behavior must be identical — just a source change.

### Refactor `apps/habitual-web/netlify/functions/_utils/article-pipeline.cjs`
Same: replace any inline Tavily fetch with `require('@habitualos/web-search')`.

### Update `apps/signal/package.json`
Add to dependencies:
```json
"@habitualos/web-search": "workspace:*"
```

### Run
```
pnpm install
```
from monorepo root to link the workspace package.

---

## Part B: `signal-contacts` Firestore Service

### Read first
- `/Users/erik/Sites/habitualos/apps/signal/netlify/functions/_services/db-signal-guest-evals.cjs` — copy the exact CJS pattern (collection name, FieldValue.serverTimestamp, etc.)
- `/Users/erik/Sites/habitualos/apps/signal/netlify/functions/_services/db-signal-owners.cjs` — understand owner schema (used for ownership validation)

### Create `netlify/functions/_services/db-signal-contacts.cjs`

```js
'use strict';
const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-contacts';

/**
 * Contact document schema:
 * {
 *   _contactId, _ownerId, name, title, company,
 *   linkedinUrl, personalSiteUrl, email, emailSource,
 *   source ('discovery'|'csv'|'scraper'), sourceQuery,
 *   rawText (capped 8000 chars),
 *   profile: { skills[], domains[], trajectory, summary },
 *   score: { domain, trajectory, style, overall, confidence, summary, sharedGrounds[] },
 *   outreachStatus ('pending'|'sent'|'skipped'|'failed'|'unsubscribed'),
 *   outreachSentAt, outreachEmailId,
 *   _createdAt, _updatedAt
 * }
 */

async function createContact(ownerId, data) {
  const contactId = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection(COLLECTION).doc(contactId).set({
    _contactId: contactId,
    _ownerId: ownerId,
    outreachStatus: 'pending',
    outreachSentAt: null,
    outreachEmailId: null,
    ...data,
    rawText: data.rawText ? String(data.rawText).slice(0, 8000) : '',
    _createdAt: now,
    _updatedAt: now,
  });
  return contactId;
}

async function getContactById(contactId) {
  const doc = await db.collection(COLLECTION).doc(contactId).get();
  return doc.exists ? doc.data() : null;
}

async function getContactsByOwnerId(ownerId, { limit = 100, status } = {}) {
  let query = db.collection(COLLECTION).where('_ownerId', '==', ownerId);
  // status filter applied in JS (db-core doesn't support additional where chains cleanly)
  const snap = await query.get();
  let docs = snap.docs.map(d => d.data());
  if (status) docs = docs.filter(d => d.outreachStatus === status);
  return docs
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))
    .slice(0, limit);
}

async function updateContact(contactId, data) {
  await db.collection(COLLECTION).doc(contactId).set(
    { ...data, _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Upsert by linkedinUrl — idempotent for re-scraping same person.
 * If no linkedinUrl, always creates a new doc.
 */
async function upsertContactByLinkedIn(ownerId, linkedinUrl, data) {
  if (!linkedinUrl) return createContact(ownerId, data);

  const snap = await db.collection(COLLECTION)
    .where('_ownerId', '==', ownerId)
    .where('linkedinUrl', '==', linkedinUrl)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await updateContact(doc.id, data);
    return doc.id;
  }
  return createContact(ownerId, { linkedinUrl, ...data });
}

module.exports = { createContact, getContactById, getContactsByOwnerId, updateContact, upsertContactByLinkedIn };
```

---

## Critical Files

| File | Action |
|---|---|
| `packages/web-search/package.json` | New |
| `packages/web-search/index.cjs` | New |
| `apps/habitual-web/package.json` | Add dep |
| `apps/habitual-web/netlify/functions/_utils/discovery-pipeline.cjs` | Refactor import |
| `apps/habitual-web/netlify/functions/_utils/article-pipeline.cjs` | Refactor import |
| `apps/signal/package.json` | Add dep |
| `netlify/functions/_services/db-signal-contacts.cjs` | New |

---

## Do not commit
Leave all changes for review.

## Verification
1. `pnpm install` from monorepo root completes without errors
2. `require('@habitualos/web-search')` resolves from signal functions directory
3. habitual-web discovery/article pipelines still import without errors (no runtime change)
4. `db-signal-contacts.cjs` exports: createContact, getContactById, getContactsByOwnerId, updateContact, upsertContactByLinkedIn
