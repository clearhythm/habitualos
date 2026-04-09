require('dotenv').config();
const { getGuestEvalById, updateGuestEval } = require('./_services/db-signal-guest-evals.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { guestId, gevalId, toolUse } = JSON.parse(event.body || '{}');
    const { name, input } = toolUse || {};

    if (name !== 'finish_interview') {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { error: `Unknown tool: ${name}` } }),
      };
    }

    if (!gevalId || !guestId) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { error: 'gevalId and guestId required' } }),
      };
    }

    const geval = await getGuestEvalById(gevalId);
    if (!geval || geval._guestId !== guestId) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { error: 'Eval not found or forbidden' } }),
      };
    }

    const improvements = input?.improvements || [];
    await updateGuestEval(gevalId, { coachingImprovements: improvements });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: { ok: true } }),
    };

  } catch (error) {
    console.error('[signal-guest-coach-execute] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
