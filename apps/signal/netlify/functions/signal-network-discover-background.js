require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { tavilySearch } = require('@habitualos/web-search');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { upsertContactByLinkedIn } = require('./_services/db-signal-contacts.cjs');
const { scorePersonAgainstOwner } = require('./_services/signal-score-person.cjs');
const { resolveApiKey } = require('./_services/crypto.cjs');
const { extractProfile } = require('./_services/signal-extract-profile.cjs');

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
    _ownerId: owner.id,
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
      const apiKey = resolveApiKey(owner);
      if (!apiKey) {
        await db.collection(JOB_COLLECTION).doc(jobId).update({
          status: 'error',
          error: 'No Anthropic API key configured',
          _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }
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

          const contactId = await upsertContactByLinkedIn(owner.id, profile.linkedinUrl, {
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
