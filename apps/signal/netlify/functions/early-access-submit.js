require('dotenv').config();
const { submitInterest } = require('./_services/db-early-access.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  try {
    const { name, message, email, link } = JSON.parse(event.body || '{}');

    // At least a name or message required — otherwise truly empty
    if (!name && !message && !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Tell us something — even just your name.' }) };
    }

    // Basic email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'That email doesn\'t look right.' }) };
    }

    const id = await submitInterest({ name, message, email, link });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, id })
    };

  } catch (err) {
    console.error('[early-access-submit] ERROR:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Something went wrong.' }) };
  }
};
