require('dotenv').config();
const dbAgentChats = require('./_services/db-agent-chats.cjs');

/**
 * POST /api/agent-chat-save
 * Save agent work chat to Firestore when a draft action or asset is generated
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
    const { userId, agentId, messages, generatedAssets, generatedActions, chatId, mode } = JSON.parse(event.body);

    // Validate required fields
    if (!userId || !agentId || !messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, agentId, messages (array)'
        })
      };
    }

    let result;

    if (mode === 'append' && chatId) {
      // APPEND mode: Update existing chat with new messages
      result = await dbAgentChats.appendToAgentChat(
        chatId,
        messages,
        generatedAssets || [],
        generatedActions || []
      );
    } else {
      // CREATE mode: Create new chat
      const newChatId = `agc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const chatData = {
        _userId: userId,
        agentId,
        messages,
        generatedAssets: generatedAssets || [],
        generatedActions: generatedActions || []
      };

      result = await dbAgentChats.createAgentChat(newChatId, chatData);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        chatId: result.id
      })
    };

  } catch (error) {
    console.error('Error saving agent chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
