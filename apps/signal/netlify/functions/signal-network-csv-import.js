require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { tavilySearch } = require('@habitualos/web-search');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { upsertContactByLinkedIn } = require('./_services/db-signal-contacts.cjs');
const { scorePersonAgainstOwner } = require('./_services/signal-score-person.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { extractProfile } = require('./_services/signal-extract-profile.cjs');

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


// MVP cap: keep well under Netlify's 26s function timeout
const CAP = 20;

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

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const anthropic = new Anthropic({ apiKey });

    const rows = parseLinkedInCsv(csvText);
    if (rows.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No rows found in CSV. Ensure it is a LinkedIn connections export.' }) };
    }

    const contacts = [];

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
        const profile = await extractProfile(rawText, anthropic);

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

        const contactId = await upsertContactByLinkedIn(owner.id, mergedProfile.linkedinUrl, contactData);
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
