# TICKET-4: LinkedIn CSV Import

## Why this exists

LinkedIn lets you export your connections as a CSV. This ticket ingests that CSV: for each connection, it searches for their web presence, extracts a profile, scores them against the owner, and upserts them into `signal-contacts`. Connections who already provided their email in the CSV skip the Hunter lookup step in TICKET-5.

This is TICKET-4 of 6. Depends on TICKET-1 (primitives), TICKET-2 (profile scraper pattern), and TICKET-3 (discovery pipeline pattern).

---

## Read first

- `netlify/functions/signal-profile-scrape.js` (TICKET-2) — Haiku extraction prompt + tavilySearch + scorePersonAgainstOwner pattern; copy it directly
- `netlify/functions/_services/db-signal-owners.cjs` — `getOwnerByUserId()`
- `netlify/functions/_services/db-signal-contacts.cjs` — `upsertContactByLinkedIn()`
- `netlify/functions/_services/signal-score-person.cjs` — `scorePersonAgainstOwner()`

---

## LinkedIn CSV format

LinkedIn connection exports (`Settings & Privacy → Data Privacy → Get a copy of your data → Connections`) produce a CSV with these columns:

```
First Name,Last Name,Email Address,Company,Position,Connected On
```

- Fields may be quoted with `"`
- Email Address is often empty (LinkedIn doesn't share it unless the connection opted in)
- The file starts with a few header lines before the column row — skip lines until the `First Name` header is found

---

## Create `netlify/functions/signal-network-csv-import.js`

```js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
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

/**
 * Minimal CSV parser for LinkedIn exports.
 * Handles quoted fields with embedded commas.
 * Returns array of objects keyed by header row.
 */
function parseLinkedInCsv(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);

  // Find the header row (contains "First Name")
  const headerIdx = lines.findIndex(l => l.includes('First Name'));
  if (headerIdx === -1) return [];

  const headers = parseRow(lines[headerIdx]);
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (values[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseRow(line) {
  const fields = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const EXTRACT_PROMPT = (rawText) => `Extract a person profile from this web content.

If this is NOT a person's profile page (news article, company homepage, job listing), return exactly:
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, csvText } = JSON.parse(event.body || '{}');
    if (!userId || !csvText) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and csvText required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const apiKey = decryptApiKey(owner.anthropicApiKey);
    const anthropic = new Anthropic({ apiKey });

    const rows = parseLinkedInCsv(csvText);
    if (rows.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No rows found in CSV. Ensure it is a LinkedIn connections export.' }) };
    }

    const contacts = [];
    const CAP = 100; // don't process more than 100 rows per import

    for (const row of rows.slice(0, CAP)) {
      const firstName = row['First Name'] || '';
      const lastName = row['Last Name'] || '';
      const company = row['Company'] || '';
      const position = row['Position'] || '';
      const emailFromCsv = row['Email Address'] || '';

      if (!firstName && !lastName) continue;

      try {
        // Search for this person
        const query = `"${firstName} ${lastName}" ${company}`.trim();
        const results = await tavilySearch(query, { maxResults: 3 });
        const rawText = results.map(r => [r.title, r.content].filter(Boolean).join('\n')).join('\n\n').slice(0, 8000);

        // Extract profile with Haiku
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
        });
        const raw = msg.content[0]?.text || '{}';
        const match = raw.match(/\{[\s\S]*\}/);
        const profile = JSON.parse(match ? match[0] : raw);

        if (profile.notAPerson) continue;

        // Prefer CSV data for name/title/company if Haiku came up sparse
        const mergedProfile = {
          name: profile.name || `${firstName} ${lastName}`.trim(),
          title: profile.title || position,
          company: profile.company || company,
          linkedinUrl: profile.linkedinUrl || null,
          personalSiteUrl: profile.personalSiteUrl || null,
          skills: profile.skills || [],
          domains: profile.domains || [],
          trajectory: profile.trajectory || '',
          summary: profile.summary || '',
        };

        // Score
        const score = await scorePersonAgainstOwner({ owner, contactProfile: mergedProfile, anthropicClient: anthropic });

        // Build contact data — include CSV email so outreach can skip Hunter
        const contactData = {
          ...mergedProfile,
          rawText,
          source: 'csv',
          sourceQuery: query,
          score,
        };
        if (emailFromCsv) {
          contactData.email = emailFromCsv;
          contactData.emailSource = 'csv';
        }

        const contactId = await upsertContactByLinkedIn(owner.signalId, mergedProfile.linkedinUrl, contactData);
        contacts.push({ contactId, name: mergedProfile.name, score });

      } catch (e) {
        console.warn(`[csv-import] row failed (${firstName} ${lastName}):`, e.message);
        // non-fatal — continue with next row
      }
    }

    const topMatches = [...contacts]
      .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))
      .slice(0, 10);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        total: rows.length,
        processed: Math.min(rows.length, CAP),
        scored: contacts.length,
        topMatches,
      }),
    };

  } catch (error) {
    console.error('[signal-network-csv-import] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
```

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/signal-network-csv-import.js` | New |

---

## Note on timeouts

This endpoint processes up to 100 rows synchronously. At ~2-3s per row (Tavily + Haiku), that's 3-5 minutes worst case — well over Netlify's 26s function limit. Two options:
1. **Cap at 20-30 rows** in the function (safest for MVP)
2. **Convert to background function** (rename to `signal-network-csv-import-background.js`, add polling) — same pattern as TICKET-3

For MVP, cap at 20 rows and document the limitation. Update the `CAP` constant to 20 before shipping.

---

## Do not commit
Leave all changes for review.

## Verification
1. Export a LinkedIn connections CSV from LinkedIn Settings
2. POST `/api/signal-network-csv-import` with `{ userId: "<your userId>", csvText: "<csv contents>" }`
3. Expect: `{ success: true, total: N, scored: M, topMatches: [...] }`
4. Check Firestore `signal-contacts` for new docs with `source: 'csv'`
5. For connections with email in CSV: verify `emailSource: 'csv'` is stored
