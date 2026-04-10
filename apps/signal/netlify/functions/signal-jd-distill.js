require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { resolveApiKey } = require('./_services/crypto.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JD_DISTILL_PROMPT = (rawJd) => `Extract the signal from this job description. Strip all boilerplate (company history, benefits, EEO, legal text). Return ONLY valid JSON with these fields:

{
  "roleTitle": "exact title from JD",
  "level": "IC level or seniority signal (e.g. Principal, Staff, VP)",
  "responsibilities": ["3-5 core responsibilities, specific and concrete"],
  "mustHave": ["actual hard requirements — years exp, specific skills, domains"],
  "niceToHave": ["preferred but not required"],
  "cultureSignals": ["2-3 inferences about working style, org type, pace"],
  "compensation": "range if listed, else null",
  "workModel": "remote/hybrid/onsite details if listed, else null"
}

Job description:
${rawJd}`;

function flattenJdSummary(jdSummary) {
  return [
    `Role: ${jdSummary.roleTitle} (${jdSummary.level || 'unspecified level'})`,
    jdSummary.responsibilities?.length ? `Responsibilities:\n${jdSummary.responsibilities.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.mustHave?.length ? `Must have:\n${jdSummary.mustHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.niceToHave?.length ? `Nice to have:\n${jdSummary.niceToHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.cultureSignals?.length ? `Culture signals:\n${jdSummary.cultureSignals.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.compensation ? `Compensation: ${jdSummary.compensation}` : '',
    jdSummary.workModel ? `Work model: ${jdSummary.workModel}` : '',
  ].filter(Boolean).join('\n\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, content } = JSON.parse(event.body || '{}');

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!content?.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'content required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const apiKey = resolveApiKey(owner);
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No API key configured' }) };
    }

    const rawContent = String(content).slice(0, 8000);
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: JD_DISTILL_PROMPT(rawContent) }],
    });

    const raw = msg.content[0]?.text || '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    const jdSummary = JSON.parse(match ? match[0] : raw);
    const distilledContent = flattenJdSummary(jdSummary);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, jdSummary, distilledContent }),
    };

  } catch (error) {
    console.error('[signal-jd-distill] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
