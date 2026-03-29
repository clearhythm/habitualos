require('dotenv').config();
const { editInterest } = require('./_services/db-early-access.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  try {
    const { id, name, message, link } = JSON.parse(event.body || '{}');

    if (!id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Missing id.' }) };
    }

    await editInterest({ id, name, message, link });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('[early-access-edit] ERROR:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Something went wrong.' }) };
  }
};
