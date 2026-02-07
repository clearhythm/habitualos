/**
 * API Security Wrapper
 *
 * Wraps handlers with security rules that are checked before execution.
 * Admin requests (isAdmin=true) bypass all security checks.
 *
 * CURRENT STATE (localStorage-based auth):
 * - authContext.userId comes from query parameter (?userId=xxx)
 * - This prevents casual URL manipulation attacks
 *
 * FUTURE STATE (session-based auth):
 * - authContext.userId will come from HTTP-only session cookie
 * - No code changes needed in this file - just update api-auth.cjs
 */

/**
 * Verify document ownership
 *
 * Checks if a document's _userId field matches the authenticated user.
 * Admins bypass this check.
 *
 * @param {Object} doc - Document from Firestore
 * @param {Object} authContext - Authentication context
 * @returns {Object|null} - Error response object if forbidden, null if allowed
 */
function verifyDocumentOwnership(doc, authContext) {
  if (authContext.isAdmin) {
    return null;
  }

  if (!doc) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Document not found' })
    };
  }

  if (doc._userId !== authContext.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden - cannot access other users\' data' })
    };
  }

  return null;
}

/**
 * Wrap a handler with security rules
 *
 * @param {Function} handler - Handler function (event, authContext) => response
 * @param {Object} options - Security options
 * @param {boolean} options.requireUserId - Require authenticated user
 * @param {boolean} options.enforceUserIdMatch - Require userId param to match authenticated userId
 * @returns {Function} Wrapped handler that enforces security rules
 */
function requireAuth(handler, options = {}) {
  return async (event, authContext) => {
    if (authContext.isAdmin) {
      authContext.verifyOwnership = () => null;
      return handler(event, authContext);
    }

    const { requireUserId = false, enforceUserIdMatch = false } = options;

    if (requireUserId && !authContext.userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    if (enforceUserIdMatch) {
      let requestedUserId = event.queryStringParameters?.userId;

      if (!requestedUserId && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
        try {
          const body = JSON.parse(event.body || '{}');
          requestedUserId = body.userId || body.guest_id;
        } catch {
          // Invalid JSON - will be caught by handler
        }
      }

      if (!requestedUserId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'userId parameter required' })
        };
      }

      if (requestedUserId !== authContext.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            error: 'Forbidden - cannot access other users\' data'
          })
        };
      }
    }

    authContext.verifyOwnership = (doc) => verifyDocumentOwnership(doc, authContext);

    return handler(event, authContext);
  };
}

module.exports = { requireAuth };
