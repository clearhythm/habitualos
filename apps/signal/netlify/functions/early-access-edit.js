require('dotenv').config();
const { editInterest, getInterestById } = require('./_services/db-early-access.cjs');
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
    const { id, name, message, link, email, resendConfirmation } = JSON.parse(event.body || '{}');

    if (!id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Missing id.' }) };
    }

    await editInterest({ id, name, message, link, email });

    if (resendConfirmation) {
      const doc = await getInterestById(id);
      if (doc && doc.confirmToken) {
        const toEmail = email || doc.email;
        if (toEmail) {
          sendEarlyAccessWelcome({ to: toEmail, name: doc.name, slug: doc.claimedSlug, confirmToken: doc.confirmToken })
            .catch(err => console.error('[early-access-edit] email error:', err.message));
        }
      }
    }

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
