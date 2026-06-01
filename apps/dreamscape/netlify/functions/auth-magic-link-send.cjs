const { createAuthToken } = require('./_utils/create-auth-token.cjs');
const { sendMagicLink } = require('./_utils/email.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email, guestId, pendingUserId, pendingRegistration;
  try {
    ({ email, guestId, pendingUserId, pendingRegistration } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  try {
    const { verifyUrl, userId, isNewUser } = await createAuthToken({
      email, guestId, pendingUserId, pendingRegistration, host: event.headers?.host,
    });
    await sendMagicLink({ to: email.toLowerCase().trim(), verifyUrl });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...(isNewUser ? { userId } : {}) }),
    };
  } catch (err) {
    log('error', '[auth-magic-link-send] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send magic link' }) };
  }
};
