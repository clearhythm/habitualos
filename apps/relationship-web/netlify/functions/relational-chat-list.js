/**
 * GET /api/relational-chat-list
 * List relational chats for a user, decrypting message content.
 */

require('dotenv').config();
const { createChatService } = require('@habitualos/chat-storage');
const { decryptMessages } = require('./_services/chat-crypto.cjs');

const chatService = createChatService({ collection: 'moment-chats', idPrefix: 'rc' });

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, limit } = event.queryStringParameters || {};

    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    let chats = await chatService.getChatsByUserId(userId);

    // Decrypt message content
    chats = chats.map(chat => ({
      ...chat,
      messages: decryptMessages(chat.messages, userId)
    }));

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        chats = chats.slice(0, limitNum);
      }
    }

    const totalCount = await chatService.getChatCount(userId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        relationalChats: chats,
        count: chats.length,
        totalCount
      })
    };

  } catch (error) {
    console.error('Error listing relational chats:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
