/**
 * @habitualos/auth-server - tokens.cjs
 *
 * Firestore-backed token store for magic links and other short-lived tokens.
 * Collection: `tokens`
 */

const { db, admin } = require('@habitualos/db-core/firestore.cjs');

function generateTokenId() {
  // 24-char URL-safe random ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 24; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Create a new token document.
 *
 * @param {Object} options
 * @param {string} options.tokenType - e.g. 'magic-link'
 * @param {Object} options.attributes - arbitrary payload (userId, email, guestId, etc.)
 * @param {number} [options.expiresInMinutes=15]
 * @returns {Promise<string>} tokenId
 */
async function createToken({ tokenType, attributes, expiresInMinutes = 15 }) {
  const tokenId = generateTokenId();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await db.collection('tokens').doc(tokenId).set({
    _tokenType: tokenType,
    _expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
    attributes,
    consumptions: []
  });

  return tokenId;
}

/**
 * Validate a token.
 *
 * @param {string} tokenId
 * @param {string} expectedType
 * @returns {Promise<{ valid: boolean, expired: boolean, consumed: boolean, token: Object|null }>}
 */
async function validateToken(tokenId, expectedType) {
  if (!tokenId) return { valid: false, expired: false, consumed: false, token: null };

  const snap = await db.collection('tokens').doc(tokenId).get();

  if (!snap.exists) {
    return { valid: false, expired: false, consumed: false, token: null };
  }

  const token = { id: snap.id, ...snap.data() };

  if (token._tokenType !== expectedType) {
    return { valid: false, expired: false, consumed: false, token: null };
  }

  const now = new Date();
  const expiresAt = token._expiresAt?.toDate?.() || new Date(0);
  if (now > expiresAt) {
    return { valid: false, expired: true, consumed: false, token };
  }

  if (token.consumptions && token.consumptions.length > 0) {
    return { valid: false, expired: false, consumed: true, token };
  }

  return { valid: true, expired: false, consumed: false, token };
}

/**
 * Record a consumption on a token (makes it one-time-use).
 *
 * @param {string} tokenId
 * @param {Object} data - metadata to store with the consumption
 */
async function recordConsumption(tokenId, data = {}) {
  const consumption = {
    ...data,
    _consumedAt: new Date().toISOString()
  };

  await db.collection('tokens').doc(tokenId).update({
    consumptions: admin.firestore.FieldValue.arrayUnion(consumption)
  });
}

/**
 * Convenience: create a magic-link token.
 *
 * @param {string} userId
 * @param {string} email
 * @param {string|null} guestId - anonymous ID from the requesting device
 * @returns {Promise<string>} tokenId
 */
async function createMagicLinkToken(userId, email, guestId = null) {
  return createToken({
    tokenType: 'magic-link',
    attributes: { userId, email, guestId },
    expiresInMinutes: 15
  });
}

module.exports = {
  createToken,
  validateToken,
  recordConsumption,
  createMagicLinkToken
};
