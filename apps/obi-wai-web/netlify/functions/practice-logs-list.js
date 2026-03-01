require('dotenv').config();
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

/**
 * GET /api/practice-logs-list?userId=u-abc123
 * Get all practice logs (check-in history timeline) for a user
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

    // Get all practice logs for this user (already sorted by timestamp desc)
    let logs = await getPracticeLogsByUserId(userId);

    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        logs = logs.slice(0, limitNum);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        practices: logs, // Keep "practices" key for backward compatibility with frontend
        count: logs.length
      })
    };

  } catch (error) {
    console.error('Error in practice-logs-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
