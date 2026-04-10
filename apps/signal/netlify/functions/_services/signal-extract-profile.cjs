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
