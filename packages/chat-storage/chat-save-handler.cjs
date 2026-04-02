/**
 * packages/chat-storage/chat-save-handler.cjs
 * ------------------------------------------------------
 * Factory for creating chat save endpoint handlers.
 * Always overwrites the full message array — no append mode.
 * chatId is generated on first save and returned to the client,
 * subsequent saves reuse it to overwrite in place.
 */

require('dotenv').config();
const { createChatService } = require('./db-chats.cjs');

function createChatSaveHandler({ collection, idPrefix }) {
  const chatService = createChatService({ collection, idPrefix });

  return async (event) => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
    }

    try {
      const { userId, signalId, messages, chatId: existingChatId } = JSON.parse(event.body);

      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'userId is required' }) };
      }
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'messages array is required' }) };
      }

      const chatId = existingChatId || chatService.generateChatId();

      await chatService.upsertChat(chatId, {
        _userId: userId,
        signalId: signalId || null,
        messages,
        savedAt: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, chatId }),
      };

    } catch (error) {
      console.error(`Error saving chat to ${collection}:`, error);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message || 'Internal server error' }) };
    }
  };
}

module.exports = { createChatSaveHandler };
