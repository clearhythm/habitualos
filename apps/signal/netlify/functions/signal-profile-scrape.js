require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { tavilySearch } = require('@habitualos/web-search');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { upsertContactByLinkedIn } = require('./_services/db-signal-contacts.cjs');
const { scorePersonAgainstOwner } = require('./_services/signal-score-person.cjs');
const { decrypt } = require('./_services/crypto.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, url } = JSON.parse(event.body || '{}');
    if (!userId || !url) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and url required' }) };
    }

    // Validate owner
    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const anthropic = new Anthropic({ apiKey });

    // Step 1: Fetch raw content for the URL
    const primaryResults = await tavilySearch(url, { includeRawContent: true, maxResults: 3 });
    let rawText = primaryResults.map(r => [r.title, r.content, r.raw_content].filter(Boolean).join('\n')).join('\n\n');
    rawText = rawText.slice(0, 8000);

    // Step 2: Haiku extraction
    const extractMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
    });

    const extractRaw = extractMsg.content[0]?.text || '{}';
    const extractMatch = extractRaw.match(/\{[\s\S]*\}/);
    const profile = JSON.parse(extractMatch ? extractMatch[0] : extractRaw);

    if (profile.notAPerson) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, notAPerson: true }),
      };
    }

    // Step 3: Supplement with name+company search if we have those
    if (profile.name && profile.company) {
      try {
        const supplementResults = await tavilySearch(`"${profile.name}" ${profile.company}`, { maxResults: 3 });
        const supplementText = supplementResults.map(r => [r.title, r.content].filter(Boolean).join('\n')).join('\n\n');
        rawText = (rawText + '\n\n' + supplementText).slice(0, 8000);
      } catch (e) {
        // non-fatal — proceed with what we have
        console.warn('[signal-profile-scrape] supplement search failed:', e.message);
      }
    }

    // Step 4: Score against owner
    const score = await scorePersonAgainstOwner({ owner, contactProfile: profile, anthropicClient: anthropic });

    // Step 5: Upsert contact (owner.id is the signalId doc key)
    const contactId = await upsertContactByLinkedIn(owner.id, profile.linkedinUrl, {
      ...profile,
      rawText,
      source: 'scraper',
      sourceQuery: url,
      score,
    });

    const contact = { _contactId: contactId, ...profile, score, source: 'scraper' };

    // Step 6: Trigger outreach for high-score contacts (non-fatal, fire-and-forget)
    if (score.overall >= 8) {
      fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/signal-network-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, contactId }),
      }).catch(e => console.warn('[signal-profile-scrape] outreach trigger failed:', e.message));
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, contact, score }),
    };

  } catch (error) {
    console.error('[signal-profile-scrape] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
