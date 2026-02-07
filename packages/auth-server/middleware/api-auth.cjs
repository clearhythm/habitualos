/**
 * API Authentication Middleware
 *
 * Validates API requests and determines authorization level.
 *
 * Authorization levels:
 * - Admin: APP_ENV === 'admin' AND ADMIN_API_KEY matches
 * - User: Has valid userId (from localStorage for now, sessions later)
 * - Anonymous: No authentication
 *
 * Usage:
 *   const { authenticate } = require('@habitualos/auth-server');
 *   const authContext = await authenticate(event);
 *   if (authContext.isAdmin) { ... }
 *   if (authContext.userId) { ... }
 */

/**
 * Authenticate an incoming API request
 *
 * @param {Object} event - Netlify function event object
 * @returns {Object} Authentication context
 *   - isAdmin {boolean} - True if APP_ENV is 'admin' AND ADMIN_API_KEY is valid
 *   - userId {string|null} - User ID from request (not yet validated)
 *   - authenticated {boolean} - True if user has valid auth (future: session-based)
 */
async function authenticate(event) {
  // Check if running in admin environment with valid API key
  // The real security boundary is Netlify's environment variable management.
  // Only the site owner can set ADMIN_API_KEY in Netlify's admin panel.
  const EXPECTED_ADMIN_KEY = 'ir93w_HY_q13ZkkV4ELmA6ztpfD751iAWyOOistF3io';

  const isAdmin = process.env.APP_ENV === 'admin'
    && process.env.ADMIN_API_KEY
    && process.env.ADMIN_API_KEY === EXPECTED_ADMIN_KEY;

  // Extract userId from query params (placeholder auth for now)
  // TODO: When we add magic link auth, validate userId from session cookie instead
  const userId = event.queryStringParameters?.userId || null;

  // For now, we consider any request with a userId as "authenticated"
  // This will change when we implement proper session-based auth
  const authenticated = !!userId;

  return {
    isAdmin,
    userId,
    authenticated
  };
}

module.exports = { authenticate };
