require('dotenv').config();
const { getUserByEmail, getUserById } = require('@habitualos/auth-server');

/**
 * GET /api/users
 *
 * User lookup endpoint for sign-in flow.
 * Supports lookup by email (unauthenticated) or by docId.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { email, docId } = event.queryStringParameters || {};

  try {
    if (email) {
      const user = await getUserByEmail(email);
      if (!user) {
        return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      };
    }

    if (docId) {
      const user = await getUserById(docId);
      if (!user) {
        return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'email or docId parameter required' }) };
  } catch (error) {
    console.error('users handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
