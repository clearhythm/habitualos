require('dotenv').config();
const { getAllMoments } = require('./_services/db-moments.cjs');

/**
 * GET /api/moment-list?limit=...
 *
 * Returns all moments across all users, newest first.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

    const moments = await getAllMoments();
    const limited = moments.slice(0, limit);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        moments: limited,
        count: limited.length,
        totalCount: moments.length
      })
    };

  } catch (error) {
    console.error('[moment-list] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to load moments' })
    };
  }
};
