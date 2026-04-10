# TICKET-3: Discovery Pipeline — Queries → Contacts (Background)

## Why this exists

Given a set of plain-English search queries ("product designers building AI tools NYC"), this pipeline finds real people on the web, extracts their profiles, scores them against the owner, and stores the high-quality matches in `signal-contacts`. It runs as a Netlify background function (15-min limit) because the work is CPU-bound and latency-tolerant. The client polls a status endpoint.

This is TICKET-3 of 6. Depends on TICKET-1 and TICKET-2 completing first.

---

## Read first

- `netlify/functions/signal-profile-scrape.js` (created in TICKET-2) — Haiku extraction prompt + tavilySearch pattern to reuse
- `netlify/functions/signal-guest-improve-background.js` — background function pattern (202 response, async work, result stored in Firestore)
- `netlify/functions/signal-guest-improve-status.js` — polling status endpoint pattern
- `netlify/functions/_services/db-signal-owners.cjs` — `getOwnerByUserId()`
- `netlify/functions/_services/db-signal-contacts.cjs` — `upsertContactByLinkedIn()`
- `netlify/functions/_services/signal-score-person.cjs` — `scorePersonAgainstOwner()`
- `netlify.toml` — see current structure before adding background fn config

---

## Step 1: Update `netlify.toml`

Add after the existing `[functions]` block:

```toml
[functions."signal-network-discover-background"]
  timeout = 900
```

---

## Step 2: Create `netlify/functions/signal-network-discover-background.js`

Netlify background functions must be named `*-background.js`. The handler returns 202 immediately; actual work happens after the response.

```js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { tavilySearch } = require('@habitualos/web-search');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { upsertContactByLinkedIn } = require('./_services/db-signal-contacts.cjs');
const { scorePersonAgainstOwner } = require('./_services/signal-score-person.cjs');
const { decryptApiKey } = require('./_services/crypto.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JOB_COLLECTION = 'signal-discover-jobs';

const EXTRACT_PROMPT = (rawText) => `Extract a person profile from this web content.

If this is NOT a person's profile page (news article, company homepage, job listing, product page), return exactly:
{"notAPerson":true}

Otherwise return ONLY valid JSON:
{
  "name": "",
  "title": "",
  "company": "",
  "linkedinUrl": null,
  "personalSiteUrl": null,
  "skills": [],
  "domains": [],
  "trajectory": "one sentence on where this person is headed professionally",
  "summary": "2-3 sentences on who this person is"
}

Web content:
${rawText.slice(0, 6000)}`;

async function extractProfile(rawText, anthropic) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
  });
  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  const { userId, queries, limit = 50 } = JSON.parse(event.body || '{}');
  if (!userId || !Array.isArray(queries) || queries.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and queries[] required' }) };
  }

  const owner = await getOwnerByUserId(userId);
  if (!owner || owner.status !== 'active') {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
  }

  // Create job doc
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection(JOB_COLLECTION).doc(jobId).set({
    _jobId: jobId,
    _ownerId: owner.signalId,
    status: 'running',
    queries,
    results: [],
    error: null,
    _createdAt: now,
    _updatedAt: now,
  });

  // Return 202 immediately — Netlify background functions continue executing after response
  const response = {
    statusCode: 202,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, jobId }),
  };

  // ── Async work begins after response ──────────────────────────────────────────
  (async () => {
    try {
      const apiKey = decryptApiKey(owner.anthropicApiKey);
      const anthropic = new Anthropic({ apiKey });

      // Gather all search results
      const seenUrls = new Set();
      const rawResults = [];

      for (const query of queries.slice(0, 10)) { // cap at 10 queries
        try {
          const results = await tavilySearch(
            `${query} site:linkedin.com OR personal site OR substack`,
            { maxResults: 5 }
          );
          for (const r of results) {
            if (r.url && !seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              rawResults.push({ ...r, sourceQuery: query });
            }
          }
        } catch (e) {
          console.warn(`[discover] query failed: "${query}"`, e.message);
        }
      }

      // Extract profiles (dedupe by name+company)
      const seenPersons = new Set();
      const profiles = [];

      for (const result of rawResults.slice(0, 40)) { // cap per-result processing
        try {
          const rawText = [result.title, result.content, result.raw_content].filter(Boolean).join('\n').slice(0, 8000);
          const profile = await extractProfile(rawText, anthropic);
          if (profile.notAPerson || !profile.name) continue;

          const dedupeKey = `${(profile.name || '').toLowerCase()}|${(profile.company || '').toLowerCase()}`;
          if (seenPersons.has(dedupeKey)) continue;
          seenPersons.add(dedupeKey);

          profiles.push({ profile, rawText, sourceQuery: result.sourceQuery });
        } catch (e) {
          console.warn('[discover] extract failed:', e.message);
        }
      }

      // Score and persist
      const savedContacts = [];

      for (const { profile, rawText, sourceQuery } of profiles) {
        try {
          const score = await scorePersonAgainstOwner({ owner, contactProfile: profile, anthropicClient: anthropic });
          if (score.overall < 6) continue; // filter noise

          const contactId = await upsertContactByLinkedIn(owner.signalId, profile.linkedinUrl, {
            ...profile,
            rawText,
            source: 'discovery',
            sourceQuery,
            score,
          });

          savedContacts.push({ contactId, name: profile.name, score });

          // Trigger outreach for top matches (non-fatal)
          if (score.overall >= 8) {
            fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/signal-network-outreach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, contactId }),
            }).catch(e => console.warn('[discover] outreach trigger failed:', e.message));
          }

          if (savedContacts.length >= limit) break;
        } catch (e) {
          console.warn('[discover] score/save failed:', e.message);
        }
      }

      // Mark done
      await db.collection(JOB_COLLECTION).doc(jobId).update({
        status: 'done',
        results: savedContacts,
        _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (err) {
      console.error('[signal-network-discover-background] FATAL:', err);
      await db.collection(JOB_COLLECTION).doc(jobId).update({
        status: 'error',
        error: err.message,
        _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
  })();

  return response;
};
```

---

## Step 3: Create `netlify/functions/signal-network-discover-status.js`

```js
require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JOB_COLLECTION = 'signal-discover-jobs';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, jobId } = JSON.parse(event.body || '{}');
    if (!userId || !jobId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and jobId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found' }) };
    }

    const doc = await db.collection(JOB_COLLECTION).doc(jobId).get();
    if (!doc.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Job not found' }) };
    }

    const job = doc.data();
    if (job._ownerId !== owner.signalId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        status: job.status,
        results: job.results || [],
        error: job.error || null,
      }),
    };

  } catch (error) {
    console.error('[signal-network-discover-status] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
```

---

## Critical Files

| File | Action |
|---|---|
| `netlify.toml` | Add background fn timeout config |
| `netlify/functions/signal-network-discover-background.js` | New |
| `netlify/functions/signal-network-discover-status.js` | New |

---

## Do not commit
Leave all changes for review.

## Verification
1. Start local dev: `npm run start`
2. POST `/api/signal-network-discover-background` with `{ userId: "<your userId>", queries: ["product designers building AI tools"] }`
3. Expect: 202 `{ success: true, jobId: "job-..." }`
4. Poll POST `/api/signal-network-discover-status` with `{ userId, jobId }` every few seconds
5. Expect: `{ status: 'running' }` → eventually `{ status: 'done', results: [{ contactId, name, score }] }`
6. Check Firestore `signal-contacts` collection for new docs with `source: 'discovery'`
