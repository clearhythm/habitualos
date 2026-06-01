const { getUserByEmail, ensureUserEmail, createMagicLinkToken } = require('@habitualos/auth-server');
const { updateUser } = require('../collections/users.cjs');
const { log } = require('./log.cjs');

const PROD_URL    = process.env.BASE_URL || 'https://daily.habitualos.com';
const VERIFY_PATH = '/signin/';

function generateUserId() {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `u-${ts}${rand}`;
}

// Resolves or creates a user, creates a magic link token, and returns the verifyUrl.
// host: the request Host header value (used to build the correct base URL locally).
async function createAuthToken({ email, guestId, pendingRegistration, host }) {
  const normalizedEmail = email.toLowerCase().trim();
  const isLocal = (host || '').includes('localhost');

  let userId;
  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser) {
    userId = existingUser.id;
  } else {
    userId = guestId || generateUserId();
    await ensureUserEmail(userId, normalizedEmail);

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
      log('debug', '[create-auth-token] stored pendingRegistration for', userId);
    }
  }

  const tokenId  = await createMagicLinkToken(userId, normalizedEmail, guestId || null);
  const baseUrl  = isLocal ? `http://${host}` : PROD_URL;
  const verifyUrl = `${baseUrl}${VERIFY_PATH}?token=${tokenId}`;

  return { userId, tokenId, verifyUrl };
}

module.exports = { createAuthToken };
