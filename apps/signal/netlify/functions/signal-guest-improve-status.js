require('dotenv').config();
const { getGuestEvalById } = require('./_services/db-signal-guest-evals.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * POST /api/signal-guest-improve-status
 * Body: { guestId, gevalId }
 *
 * Polls for completion of signal-guest-improve-background.
 * Returns { done: false } until improvedScore is present on the doc,
 * then returns { done: true, improved, originalScore, improvedScore, rewrittenSections, reason? }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { guestId, gevalId } = JSON.parse(event.body || '{}');

    if (!guestId || !gevalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'guestId and gevalId required' }) };
    }

    const geval = await getGuestEvalById(gevalId);

    if (!geval) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Eval not found' }) };
    }
    if (geval._guestId !== guestId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    if (!geval.improvedScore) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: false }),
      };
    }

    const improved = (geval.improvedScore?.overall ?? 0) > (geval.score?.overall ?? 0);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        done: true,
        improved,
        originalScore: geval.score || {},
        improvedScore: geval.improvedScore,
        rewrittenSections: geval.rewrittenSections || [],
        improvedResumeText: geval.improvedResumeText || null,
        reason: improved ? null : `The rewrite didn't move the score (${geval.score?.overall ?? 0} → ${geval.improvedScore?.overall ?? 0}). The gaps may require experience you haven't yet demonstrated — more specific outcomes or direct role overlap would help.`,
      }),
    };

  } catch (error) {
    console.error('[signal-guest-improve-status] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
