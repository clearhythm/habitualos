# TICKET: Person Network — Bug Fixes + Shared Profile Extraction

## Why this exists

Two runtime bugs were introduced by the autonomous agents that built TICKET-3 (discovery pipeline) and TICKET-4 (CSV import). Both bugs are silent failures — no startup crash, but authorization checks will always fail and discovery jobs will crash mid-run. A DRY issue (duplicate extraction logic across 3 files) is also addressed here.

**Bugs 1 and 2 are blocking.** The network feature will not work end-to-end without these fixes.

---

## Read first

Before making any changes, read these files in full to understand current state:

- `netlify/functions/_services/crypto.cjs` — exports `encrypt` and `decrypt` only. There is NO `decryptApiKey` export.
- `netlify/functions/_services/db-signal-owners.cjs` — `getOwnerByUserId()` returns `{ id: snap.docs[0].id, ...snap.docs[0].data() }`. The doc ID (`owner.id`) equals the signalId. The data field is `_signalId` (with underscore). `owner.signalId` (no underscore) is unreliable.
- `netlify/functions/signal-profile-scrape.js` — the reference implementation that correctly uses `decrypt` and `owner.id`. Match its patterns.
- `netlify/functions/signal-network-discover-background.js` — has both bugs.
- `netlify/functions/signal-network-discover-status.js` — has the `owner.signalId` bug.
- `netlify/functions/signal-network-outreach.js` — has the `owner.signalId` bug.
- `netlify/functions/signal-contacts-get.js` — has the `owner.signalId` bug.
- `netlify/functions/signal-network-csv-import.js` — has duplicated extraction logic.

---

## Bug 1: `decryptApiKey` does not exist — `signal-network-discover-background.js`

### Problem

Line 8:
```js
const { decryptApiKey } = require('./_services/crypto.cjs');
```
`crypto.cjs` has no `decryptApiKey` export. This destructures to `undefined`, so line 90:
```js
const apiKey = decryptApiKey(owner.anthropicApiKey);
```
throws `TypeError: decryptApiKey is not a function` — crashing every discovery job silently after the 202 is already sent.

Additionally, there is no fallback to `process.env.ANTHROPIC_API_KEY` when the owner has no personal key, unlike the pattern in `signal-profile-scrape.js` and `signal-network-csv-import.js`.

### Fix

Replace the import at line 8:
```js
// OLD
const { decryptApiKey } = require('./_services/crypto.cjs');
```
```js
// NEW
const { decrypt } = require('./_services/crypto.cjs');
```

Replace the API key resolution block inside the async IIFE (around line 90). Find:
```js
const apiKey = decryptApiKey(owner.anthropicApiKey);
const anthropic = new Anthropic({ apiKey });
```
Replace with:
```js
let apiKey = process.env.ANTHROPIC_API_KEY;
if (owner.anthropicApiKey) {
  try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
}
if (!apiKey) {
  await db.collection(JOB_COLLECTION).doc(jobId).update({
    status: 'error',
    error: 'No Anthropic API key configured',
    _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return;
}
const anthropic = new Anthropic({ apiKey });
```

---

## Bug 2: `owner.signalId` is unreliable — fix in 4 files

### Problem

`getOwnerByUserId` returns `{ id: snap.docs[0].id, ...snap.docs[0].data() }`. The document key (= signalId) is exposed as `owner.id`. The stored data field is `_signalId`. The property `owner.signalId` (no underscore) is only present if explicitly stored in the document data, which is not guaranteed.

All autonomous-agent files use `owner.signalId` where they should use `owner.id`. Consequences:
- Contacts are written with `_ownerId: undefined` (Firestore silently drops undefined fields)
- Authorization checks always pass or always fail depending on field presence
- `getContactsByOwnerId(undefined)` returns no results

### Fix: `signal-network-discover-background.js`

Two locations. Find:
```js
_ownerId: owner.signalId,
```
Replace with:
```js
_ownerId: owner.id,
```

Find:
```js
const contactId = await upsertContactByLinkedIn(owner.signalId, profile.linkedinUrl, {
```
Replace with:
```js
const contactId = await upsertContactByLinkedIn(owner.id, profile.linkedinUrl, {
```

### Fix: `signal-network-discover-status.js`

Find:
```js
if (job._ownerId !== owner.signalId) {
```
Replace with:
```js
if (job._ownerId !== owner.id) {
```

### Fix: `signal-network-outreach.js`

Find:
```js
if (contact._ownerId !== owner.signalId) {
```
Replace with:
```js
if (contact._ownerId !== owner.id) {
```

### Fix: `signal-contacts-get.js`

Find:
```js
const contacts = await getContactsByOwnerId(owner.signalId, { limit: 200, status });
```
Replace with:
```js
const contacts = await getContactsByOwnerId(owner.id, { limit: 200, status });
```

---

## DRY: Extract shared profile extraction to `signal-extract-profile.cjs`

### Problem

The Haiku profile extraction logic (prompt + API call + JSON parse) is duplicated across three files with slight wording differences:
- `signal-profile-scrape.js` — inline, "no explanation, no markdown" in prompt
- `signal-network-discover-background.js` — factored into local `extractProfile()`, slightly different prompt wording
- `signal-network-csv-import.js` — inline, slightly different prompt wording

Prompt drift means the three pipelines may produce different shaped output over time.

### Fix: Create `netlify/functions/_services/signal-extract-profile.cjs`

```js
'use strict';

/**
 * signal-extract-profile.cjs
 *
 * Shared Haiku-based person profile extractor.
 * Used by signal-profile-scrape, signal-network-discover-background,
 * and signal-network-csv-import.
 */

const EXTRACT_PROMPT = (rawText) => `Extract a person profile from this web content.

If this is NOT a person's profile page (e.g. news article, company homepage, job listing, product page), return exactly:
{"notAPerson":true}

Otherwise return ONLY valid JSON — no explanation, no markdown:
{
  "name": "",
  "title": "",
  "company": "",
  "linkedinUrl": null,
  "personalSiteUrl": null,
  "skills": [],
  "domains": [],
  "trajectory": "one sentence describing where this person is headed professionally",
  "summary": "2-3 sentences on who this person is and what they do"
}

Web content:
${rawText.slice(0, 6000)}`;

/**
 * Extract a structured person profile from raw web text using Haiku.
 *
 * @param {string} rawText - Raw web content (will be sliced to 6000 chars in prompt)
 * @param {object} anthropicClient - Initialized Anthropic client
 * @returns {Promise<object>} Parsed profile object, or { notAPerson: true }
 */
async function extractProfile(rawText, anthropicClient) {
  const msg = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
  });
  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

module.exports = { extractProfile };
```

### Update `signal-profile-scrape.js`

Add import at top (after existing requires):
```js
const { extractProfile } = require('./_services/signal-extract-profile.cjs');
```

Remove the local `EXTRACT_PROMPT` constant (the full template literal, ~15 lines).

Replace the Haiku extraction block:
```js
// OLD
const extractMsg = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
});

const extractRaw = extractMsg.content[0]?.text || '{}';
const extractMatch = extractRaw.match(/\{[\s\S]*\}/);
const profile = JSON.parse(extractMatch ? extractMatch[0] : extractRaw);
```
```js
// NEW
const profile = await extractProfile(rawText, anthropic);
```

### Update `signal-network-discover-background.js`

Add import at top (after existing requires):
```js
const { extractProfile } = require('./_services/signal-extract-profile.cjs');
```

Remove the local `EXTRACT_PROMPT` constant and the local `extractProfile` function definition (both, ~20 lines total).

The existing call sites already use `extractProfile(rawText, anthropic)` — no call-site changes needed.

### Update `signal-network-csv-import.js`

Add import at top (after existing requires):
```js
const { extractProfile } = require('./_services/signal-extract-profile.cjs');
```

Remove the local `EXTRACT_PROMPT` constant (~15 lines).

Replace the inline Haiku extraction block inside the row loop:
```js
// OLD
const msg = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
});
const raw = msg.content[0]?.text || '{}';
const match = raw.match(/\{[\s\S]*\}/);
const profile = JSON.parse(match ? match[0] : raw);
```
```js
// NEW
const profile = await extractProfile(rawText, anthropic);
```

---

## Do not change

- `signal-network-csv-import.js` synchronous execution model — the CAP=20 limit is intentional for MVP. Converting to a background function is out of scope here.
- Any scoring logic in `signal-score-person.cjs`
- `signal-network-outreach.js` Hunter.io domain derivation heuristic — imperfect but acceptable for MVP

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/_services/signal-extract-profile.cjs` | New |
| `netlify/functions/signal-network-discover-background.js` | Fix Bug 1 + Bug 2 + use shared extractor |
| `netlify/functions/signal-network-discover-status.js` | Fix Bug 2 |
| `netlify/functions/signal-network-outreach.js` | Fix Bug 2 |
| `netlify/functions/signal-contacts-get.js` | Fix Bug 2 |
| `netlify/functions/signal-profile-scrape.js` | Use shared extractor |
| `netlify/functions/signal-network-csv-import.js` | Use shared extractor |

---

## Rename to REVIEW- when done

Rename this file from `TICKET-` to `REVIEW-` prefix on completion.

## Verification

1. Start local dev: `npm run start`
2. POST `/api/signal-network-discover-background` with `{ userId, queries: ["AI product managers NYC"] }` — expect `{ success: true, jobId }` with status 202
3. Poll `/api/signal-network-discover-status` with `{ userId, jobId }` — expect status to move from `running` to `done` (not `error`)
4. POST `/api/signal-contacts-get` with `{ userId }` — expect contacts array (not empty due to undefined ownerId)
5. POST `/api/signal-network-outreach` with `{ userId, contactId }` for a contact created by discovery — expect `{ success: true, sent: true }` or `{ noEmail: true }`, NOT `{ error: 'Forbidden' }`
6. Verify `signal-extract-profile.cjs` is the sole source of the extraction prompt — grep for `EXTRACT_PROMPT` and confirm it only appears in the new shared file
