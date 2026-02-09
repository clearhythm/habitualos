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

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
const { getMomentsByUserId, getAllMoments } = require('./_services/db-moments.cjs');

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
  const { userId, all } = event.queryStringParameters || {};

  // When all=true, return moments from all users (for shared export)
  if (all === 'true') {
    try {
      const moments = await getAllMoments();
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
      console.error('moments-list (all) error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Internal server error' })
      };
    }
  }

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
