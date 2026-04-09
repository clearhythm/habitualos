/**
 * @habitualos/auth-server - handlers/magic-link-send.cjs
 *
 * Handler factory for the magic link send endpoint.
 * Usage:
 *   exports.handler = createMagicLinkSendHandler({ getBaseUrl, sendEmail });
 *
 * POST body: { email, guestId? }
 */

const { getUserByEmail, ensureUserEmail } = require('../services/db-users.cjs');
const { createMagicLinkToken } = require('../tokens.cjs');

function generateUserId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `u-${ts}${rand}`;
}

/**
 * @param {Object} options
 * @param {() => string} options.getBaseUrl - returns the app's base URL (e.g. from env var)
 * @param {(opts: { to: string, verifyUrl: string }) => Promise<void>} options.sendEmail
 * @returns {Function} Netlify handler
 */
function createMagicLinkSendHandler({ getBaseUrl, sendEmail }) {
  return async function handler(event) {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
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

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Find or create the user
      let userId;
      const existingUser = await getUserByEmail(normalizedEmail);

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // New user: preserve guest data by using guestId as userId
        userId = guestId || generateUserId();
        await ensureUserEmail(userId, normalizedEmail);
      }

      // Create magic link token
      const tokenId = await createMagicLinkToken(userId, normalizedEmail, guestId || null);
      const baseUrl = getBaseUrl();
      const verifyUrl = `${baseUrl}/signin/verify/?token=${tokenId}`;

      // Send email
      await sendEmail({ to: normalizedEmail, verifyUrl });

      // Always return ok — never reveal user existence
      const response = { ok: true };

      // In non-prod: include token for testing
      if (process.env.APP_ENV && process.env.APP_ENV !== 'production') {
        response.token = tokenId;
        response.verifyUrl = verifyUrl;
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
      };
    } catch (err) {
      console.error('magic-link-send error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send magic link' }) };
    }
  };
}

module.exports = { createMagicLinkSendHandler };
