/**
 * packages/chat-storage/chat-list-handler.cjs
 * ------------------------------------------------------
 * Factory for creating chat list endpoint handlers.
 */

require('dotenv').config();
const { createChatService } = require('./db-chats.cjs');

/**
 * Creates a Netlify function handler for listing chats.
 * @param {Object} config
 * @param {string} config.collection - Firestore collection name
 * @param {string} config.idPrefix - ID prefix (e.g., 'wc', 'rc')
 * @param {string} [config.responseKey='chats'] - Key name in response (e.g., 'workChats', 'relationalChats')
 */
function createChatListHandler({ collection, idPrefix, responseKey = 'chats' }) {
  const chatService = createChatService({ collection, idPrefix });

  return async (event) => {
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

      // Get chats
      let chats = await chatService.getChatsByUserId(userId);

      // Apply limit if specified
      if (limit) {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          chats = chats.slice(0, limitNum);
        }
      }

      // Get total count
      const totalCount = await chatService.getChatCount(userId);

      // Build response with configurable key name
      const response = {
        success: true,
        [responseKey]: chats,
        count: chats.length,
        totalCount
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        },
        body: JSON.stringify(response)
      };

    } catch (error) {
      console.error(`Error listing chats from ${collection}:`, error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Internal server error'
        })
      };
    }
  };
}

module.exports = { createChatListHandler };
