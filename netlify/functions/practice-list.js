require('dotenv').config();
const { getPracticesByUserId } = require('./_services/db-practices.cjs');

/**
 * GET /api/practice-list?userId=u-abc123
 * Get all practices for a user
 */
exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, limit } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Get all practices for this user (already sorted by checkins descending)
    let practices = await getPracticesByUserId(userId);

    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        practices = practices.slice(0, limitNum);
      }
    }

    // Convert Firestore Timestamps to ISO strings for frontend
    const practicesWithDates = practices.map(practice => ({
      ...practice,
      _createdAt: practice._createdAt?.toDate ? practice._createdAt.toDate().toISOString() : practice._createdAt,
      _updatedAt: practice._updatedAt?.toDate ? practice._updatedAt.toDate().toISOString() : practice._updatedAt
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        practices: practicesWithDates,
        count: practicesWithDates.length
      })
    };

  } catch (error) {
    console.error('Error in practice-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
