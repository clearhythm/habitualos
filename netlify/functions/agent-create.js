require('dotenv').config();
const { generateAgentId, generateAgentCreationChatId } = require('./_utils/data-utils.cjs');
const { createAgent } = require('./_services/db-agents.cjs');
const { createAgentCreationChat } = require('./_services/db-agent-creation-chats.cjs');

/**
 * POST /api/agent-create
 *
 * Create agent and save creation chat history.
 * See: docs/endpoints/agent-create.md
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
    // Parse request body
    const { userId, name, goal, success_criteria, timeline, type, chatHistory, localDataPath } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate required fields
    if (!name || !goal) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: name and goal are required'
        })
      };
    }

    // Create agent in Firestore
    const agentId = generateAgentId();
    const agent = await createAgent(agentId, {
      _userId: userId,
      type: type || 'northstar',
      name,
      status: 'active',
      instructions: {
        goal,
        success_criteria: success_criteria || [],
        timeline: timeline || null,
        format: 'northstar'
      },
      localDataPath: localDataPath || null,
      capabilities: {
        filesystem: !!localDataPath, // Enable if localDataPath provided
        noteCapture: true
      }
    });

    // Save agent creation chat history if provided
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      const chatId = generateAgentCreationChatId();
      await createAgentCreationChat(chatId, {
        _userId: userId,
        messages: chatHistory,
        agentId: agent.id
      });
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        agent: { id: agent.id, name, goal, success_criteria, timeline, type: type || 'northstar' }
      })
    };

  } catch (error) {
    console.error('Error in agent-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
