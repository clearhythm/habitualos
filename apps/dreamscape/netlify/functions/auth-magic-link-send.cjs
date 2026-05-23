const { getUserByEmail, ensureUserEmail, createMagicLinkToken } = require('@habitualos/auth-server');
const { updateUser } = require('./collections/users.cjs');
const { sendMagicLink } = require('./_utils/email.cjs');
const { log } = require('./_utils/log.cjs');

const PROD_URL    = process.env.BASE_URL || 'https://daily.habitualos.com';
const VERIFY_PATH = '/signin/';

function generateUserId() {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `u-${ts}${rand}`;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email, guestId, pendingRegistration, noEmail;
  try {
    ({ email, guestId, pendingRegistration, noEmail } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    let userId;
    const existingUser = await getUserByEmail(normalizedEmail);

    if (existingUser) {
      userId = existingUser.id;
      // Returning user — ignore pendingRegistration entirely
    } else {
      // New user — preserve guest data by using guestId as userId
      userId = guestId || generateUserId();
      await ensureUserEmail(userId, normalizedEmail);

      // Store pendingRegistration on user doc so it survives cross-device token consume
      if (pendingRegistration && typeof pendingRegistration === 'object') {
        const { name, chime, connectUserId, connectName } = pendingRegistration;
        await updateUser(userId, {
          pendingRegistration: {
            name:          name          || null,
            chime:         chime         || null,
            connectUserId: connectUserId || null,
            connectName:   connectName   || null,
          },
        });
        log('debug', '[auth-magic-link-send] stored pendingRegistration for', userId);
      }
    }

    const tokenId  = await createMagicLinkToken(userId, normalizedEmail, guestId || null);
    const baseUrl   = (event.headers?.host || '').includes('localhost') ? 'http://localhost:8888' : PROD_URL;
    const verifyUrl = `${baseUrl}${VERIFY_PATH}?token=${tokenId}`;

    const isLocal = (event.headers?.host || '').includes('localhost');
    if (!(noEmail && isLocal)) {
      await sendMagicLink({ to: normalizedEmail, verifyUrl });
    }

    const response = { ok: true };
    if (isLocal) {
      response.token    = tokenId;
      response.verifyUrl = verifyUrl;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err) {
    log('error', '[auth-magic-link-send] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send magic link' }) };
  }
};
