const { getUserByEmail, ensureUserEmail, createMagicLinkToken } = require('@habitualos/auth-server');
const { createInvitation } = require('../collections/invitations.cjs');
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
// pendingRegistration: invite context { name, chime, connectUserId, connectName } — present
//   when the user came through a join link. Stored as an invitation record; inviteId is
//   appended to the verifyUrl so the consume step can complete registration.
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
  }

  let inviteId = null;
  if (pendingRegistration && typeof pendingRegistration === 'object') {
    const { name, chime, connectUserId, connectName } = pendingRegistration;
    inviteId = await createInvitation({
      _source:       'link',
      inviterUserId: connectUserId || null,
      inviterName:   connectName   || null,
      inviteeName:   name          || null,
      inviteeEmail:  normalizedEmail,
      chime:         chime         || null,
    });
    log('debug', '[create-auth-token] created invitation', inviteId, 'for', userId);
  }

  const tokenId     = await createMagicLinkToken(userId, normalizedEmail, guestId || null);
  const baseUrl     = isLocal ? `http://${host}` : PROD_URL;
  const inviteParam = inviteId ? `&inviteId=${inviteId}` : '';
  const verifyUrl   = `${baseUrl}${VERIFY_PATH}?token=${tokenId}${inviteParam}`;

  return { userId, tokenId, verifyUrl, inviteId };
}

module.exports = { createAuthToken };
