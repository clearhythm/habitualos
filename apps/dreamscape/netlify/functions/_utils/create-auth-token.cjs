const { getUserByEmail, ensureUserEmail, createMagicLinkToken } = require('@habitualos/auth-server');
const { updateUser } = require('../collections/users.cjs');
const { assignSlug } = require('../collections/slugs.cjs');
const { createPendingConnection } = require('../collections/connections.cjs');
const { log } = require('./log.cjs');

const PROD_URL    = process.env.BASE_URL || 'https://daily.habitualos.com';
const VERIFY_PATH = '/signin/';

function generateUserId() {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `u-${ts}${rand}`;
}

// Resolves or creates a user, creates a magic link token, and returns the verifyUrl.
// pendingRegistration: join-flow context { name, chime, connectUserId, connectName }.
//   For new users, name/chime are saved to the user record immediately (not deferred to sign-in).
//   A pending connection is created and its connId is appended to the verifyUrl so sign-in
//   can activate it.
// pendingUserId: if the client already has a userId from a prior email submission (e.g. "change
//   email" flow), reuse it rather than generating a new one.
async function createAuthToken({ email, guestId, pendingUserId, pendingRegistration, host }) {
  const normalizedEmail = email.toLowerCase().trim();
  const isLocal = (host || '').includes('localhost');

  let userId;
  let isNewUser = false;
  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser) {
    userId = existingUser.id;
  } else {
    userId = pendingUserId || guestId || generateUserId();
    await ensureUserEmail(userId, normalizedEmail);
    isNewUser = true;

    // Save name/chime immediately — don't defer to sign-in
    if (pendingRegistration) {
      const { name, chime } = pendingRegistration;
      const updates = {};
      if (name)  { updates._name = name; updates.slug = await assignSlug(userId, name); }
      if (chime) { updates.chime = chime; }
      if (Object.keys(updates).length) await updateUser(userId, updates);
      log('debug', '[create-auth-token] saved profile for new user', userId);
    }
  }

  // Create a pending connection regardless of new/existing — connection always runs on join
  let connId = null;
  if (pendingRegistration?.connectUserId) {
    const { connectUserId, connectName, name } = pendingRegistration;
    connId = await createPendingConnection({ initiatedBy: connectUserId, receivedBy: userId, _source: 'link' });
    log('debug', '[create-auth-token] pending connection', connId, 'for', userId);
  }

  const tokenId   = await createMagicLinkToken(userId, normalizedEmail, guestId || null);
  const baseUrl   = isLocal ? `http://${host}` : PROD_URL;
  const connParam = connId ? `&connId=${connId}` : '';
  const verifyUrl = `${baseUrl}${VERIFY_PATH}?token=${tokenId}${connParam}`;

  return { userId, tokenId, verifyUrl, connId, isNewUser };
}

module.exports = { createAuthToken };
