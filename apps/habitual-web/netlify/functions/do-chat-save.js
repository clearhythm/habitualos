require('dotenv').config();
const { createWorkChat, appendToWorkChat } = require('./_services/db-work-chats.cjs');

// Helper to generate work chat ID (wc- prefix + timestamp-based unique ID)
function generateWorkChatId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomPart = Math.floor(Math.random() * 1000);
  return 'wc-' + (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

/**
 * POST /api/do-chat-save
 * Save a work chat to Firestore
 */
exports.handler = async (event) => {
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
      await appendToWorkChat(existingChatId, messages);
      chatId = existingChatId;
    } else {
      // CREATE mode: Create new chat
      chatId = generateWorkChatId();

      const chatData = {
        _userId: userId,
        messages: messages,
        savedAt: new Date().toISOString()
      };

      await createWorkChat(chatId, chatData);
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
    console.error('Error saving work chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
