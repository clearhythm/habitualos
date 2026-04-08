require('dotenv').config();
const { submitInterest, checkSlugAvailable } = require('./_services/db-early-access.cjs');
const { sendEarlyAccessWelcome } = require('./_services/email.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  try {
    const { slug, name, message, email, link } = JSON.parse(event.body || '{}');

    if (!name && !message && !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Tell us something — even just your name.' }) };
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'That email doesn\'t look right.' }) };
    }

    if (slug) {
      const available = await checkSlugAvailable(slug);
      if (!available) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ success: false, error: 'That handle is already taken.' }) };
      }
    }

    const { id, confirmToken } = await submitInterest({ slug, name, message, email, link });

    if (email) {
      try {
        await sendEarlyAccessWelcome({ to: email, name, slug, confirmToken });
      } catch (err) {
        console.error('[early-access-submit] email error:', err.message);
        // Non-fatal — record was saved, email can be retried manually
      }
    }

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
