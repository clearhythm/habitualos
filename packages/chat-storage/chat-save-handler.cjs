/**
 * packages/chat-storage/chat-save-handler.cjs
 * ------------------------------------------------------
 * Factory for creating chat save endpoint handlers.
 * Supports both create and append modes.
 */

require('dotenv').config();
const { createChatService } = require('./db-chats.cjs');

/**
 * Creates a Netlify function handler for saving chats.
 * @param {Object} config
 * @param {string} config.collection - Firestore collection name
 * @param {string} config.idPrefix - ID prefix (e.g., 'wc', 'rc')
 */
function createChatSaveHandler({ collection, idPrefix }) {
  const chatService = createChatService({ collection, idPrefix });

  return async (event) => {
    // Only allow POST
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
          body: JSON.stringify({
            success: false,
            error: 'userId is required'
          })
        };
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'messages array is required'
          })
        };
      }

      let chatId;

      if (mode === 'append' && existingChatId) {
        // APPEND mode: Update existing chat with new messages
        await chatService.appendToChat(existingChatId, messages);
        chatId = existingChatId;
      } else {
        // CREATE mode: Create new chat
        chatId = chatService.generateChatId();

        const chatData = {
          _userId: userId,
          messages: messages,
          savedAt: new Date().toISOString()
        };

        await chatService.createChat(chatId, chatData);
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          chatId: chatId
        })
      };

    } catch (error) {
      console.error(`Error saving chat to ${collection}:`, error);
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

module.exports = { createChatSaveHandler };
