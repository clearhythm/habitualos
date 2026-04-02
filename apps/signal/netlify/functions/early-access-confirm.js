require('dotenv').config();
const { confirmByToken } = require('./_services/db-early-access.cjs');
const { sendWaitlistWelcome } = require('./_services/email.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const COLLECTION_MAP = {
  'early-access': 'signal-early-access',
  'waitlist': 'signal-waitlist',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  try {
    const { token, type = 'early-access' } = JSON.parse(event.body || '{}');
    if (!token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Token required.' }) };

    const collection = COLLECTION_MAP[type];
    if (!collection) return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Invalid type.' }) };

    const confirmed = await confirmByToken(token, collection);
    if (!confirmed) return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Invalid or already used token.' }) };

    if (type === 'waitlist' && confirmed.email) {
      sendWaitlistWelcome({ to: confirmed.email }).catch(err =>
        console.error('[early-access-confirm] waitlist welcome email error:', err.message)
      );
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('[early-access-confirm] ERROR:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Something went wrong.' }) };
  }
};
