/**
 * @habitualos/auth-server - handlers/magic-link-consume.cjs
 *
 * Handler factory for the magic link consume (verify) endpoint.
 * Usage:
 *   exports.handler = createMagicLinkConsumeHandler();
 *
 * GET /api/auth/verify?token=xxx
 * Returns: { ok, userId, email, guestId, profile }
 */

const { getUserById } = require('../services/db-users.cjs');
const { validateToken, recordConsumption } = require('../tokens.cjs');

/**
 * @returns {Function} Netlify handler
 */
function createMagicLinkConsumeHandler() {
  return async function handler(event) {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const tokenId = event.queryStringParameters?.token;
    if (!tokenId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'token parameter required' }) };
    }

    try {
      const { valid, expired, consumed, token } = await validateToken(tokenId, 'magic-link');

      if (expired) {
        return { statusCode: 410, body: JSON.stringify({ error: 'Token expired' }) };
      }

      if (consumed) {
        return { statusCode: 409, body: JSON.stringify({ error: 'Token already used' }) };
      }

      if (!valid || !token) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Token not found or invalid' }) };
      }

      const { userId, email, guestId } = token.attributes || {};

      // Mark as consumed before fetching user (prevents race conditions)
      await recordConsumption(tokenId, { userId });

      // Fetch full user profile
      const user = await getUserById(userId);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          userId,
          email,
          guestId: guestId || null,
          profile: user?.profile || {}
        })
      };
    } catch (err) {
      console.error('magic-link-consume error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed' }) };
    }
  };
}

module.exports = { createMagicLinkConsumeHandler };
