/**
 * GET /api/moments-list
 *
 * List all moments for a user.
 *
 * Query params:
 *   - userId (required): User ID (format: u-{id})
 *
 * Response:
 *   { success: true, moments: [...] }
 */

require('dotenv').config();
const { getMomentsByUserId } = require('./_services/db-moments.cjs');

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Parse query params
  const { userId } = event.queryStringParameters || {};

  // Validate userId
  if (!userId || !userId.startsWith('u-')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Valid userId required' })
    };
  }

  try {
    const moments = await getMomentsByUserId(userId);

    // Convert Firestore timestamps to ISO strings
    const formatted = moments.map(m => ({
      ...m,
      _createdAt: m._createdAt?.toDate?.()?.toISOString() || m._createdAt,
      _updatedAt: m._updatedAt?.toDate?.()?.toISOString() || m._updatedAt
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, moments: formatted })
    };
  } catch (error) {
    console.error('moments-list error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
