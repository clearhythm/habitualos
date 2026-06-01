const { createAuthToken } = require('./_utils/create-auth-token.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const host = event.headers?.host || '';
  if (!host.includes('localhost')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Dev sign-in only available locally' }) };
  }

  let email, guestId;
  try {
    ({ email, guestId } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  try {
    const { tokenId, verifyUrl } = await createAuthToken({ email, guestId, host });
    log('debug', '[dev-signin] verifyUrl:', verifyUrl);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, token: tokenId, verifyUrl }),
    };
  } catch (err) {
    log('error', '[dev-signin] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Dev sign-in failed' }) };
  }
};
