require('dotenv').config();
const { getAllMoments } = require('./_services/db-moments.cjs');
const { getRepliesByMomentIds } = require('./_services/db-replies.cjs');

/**
 * GET /api/moment-list?limit=...&includeReplies=true
 *
 * Returns all moments across all users, newest first.
 * Optionally includes replies for each moment.
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
    const includeReplies = event.queryStringParameters?.includeReplies === 'true';

    const moments = await getAllMoments();
    const limited = moments.slice(0, limit);

    // Attach replies if requested
    let replies = {};
    if (includeReplies && limited.length > 0) {
      const momentIds = limited.map(m => m.id);
      replies = await getRepliesByMomentIds(momentIds);
    }

    // Merge replies onto moments
    const momentsWithReplies = limited.map(m => ({
      ...m,
      reply: replies[m.id] || null
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        moments: momentsWithReplies,
        count: momentsWithReplies.length,
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
