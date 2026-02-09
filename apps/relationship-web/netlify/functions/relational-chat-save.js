/**
 * POST /api/relational-chat-save
 * Save a relational chat to Firestore with encrypted message content.
 */

require('dotenv').config();
const { createChatService } = require('@habitualos/chat-storage');
const { encryptMessages } = require('./_services/chat-crypto.cjs');

const chatService = createChatService({ collection: 'moment-chats', idPrefix: 'rc' });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, messages, chatId: existingChatId, mode } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'userId is required' })
      };
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'messages array is required' })
      };
    }

    const encryptedMessages = encryptMessages(messages, userId);
    let chatId;

    if (mode === 'append' && existingChatId) {
      await chatService.appendToChat(existingChatId, encryptedMessages);
      chatId = existingChatId;
    } else {
      chatId = chatService.generateChatId();
      await chatService.createChat(chatId, {
        _userId: userId,
        messages: encryptedMessages,
        savedAt: new Date().toISOString()
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, chatId })
    };

  } catch (error) {
    console.error('Error saving relational chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
