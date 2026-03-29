require('dotenv').config();
const { checkSlugAvailable } = require('./_services/db-early-access.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false }) };

  try {
    const { slug } = JSON.parse(event.body || '{}');
    if (!slug || !SLUG_RE.test(slug) || slug.length > 30) {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ available: false }) };
    }
    const available = await checkSlugAvailable(slug);
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ available }) };
  } catch (err) {
    console.error('[claim-check-slug] ERROR:', err);
    return { statusCode: 500, body: JSON.stringify({ available: null }) };
  }
};
