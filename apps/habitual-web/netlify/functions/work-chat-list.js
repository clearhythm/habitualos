require('dotenv').config();
const { getWorkChatsByUserId, getWorkChatCount } = require('./_services/db-work-chats.cjs');

/**
 * GET /api/work-chat-list?userId=u-abc123
 * Get saved work chats for a user
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

    // Get work chats
    let workChats = await getWorkChatsByUserId(userId);

    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        workChats = workChats.slice(0, limitNum);
      }
    }

    // Get total count
    const totalCount = await getWorkChatCount(userId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        workChats,
        count: workChats.length,
        totalCount
      })
    };

  } catch (error) {
    console.error('Error in work-chat-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
