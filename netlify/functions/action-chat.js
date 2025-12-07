require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const {
  getAction,
  getChatMessages,
  insertChatMessage,
  updateActionState
} = require('../../db/helpers');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/action/:id/chat
 * Send user message, get AI response
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
    // Extract action ID from path
    const pathParts = event.path.split('/');
    const actionId = pathParts[pathParts.indexOf('action') + 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Parse request body
    const { message } = JSON.parse(event.body);

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Message is required'
        })
      };
    }

    // Get action details
    const action = getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Insert user message
    insertChatMessage({
      action_id: actionId,
      role: 'user',
      content: message
    });

    // Get full chat history (including the new message)
    const chatHistory = getChatMessages(actionId);

    // Build chat prompt for Claude
    const chatPrompt = `You are an AI agent helping refine an actionable task.

Action: ${action.title}
Description: ${action.description}

Conversation history:
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's latest message: ${message}

Respond helpfully to refine the action. Be concise and actionable.`;

    // Call Claude API
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: chatPrompt
      }]
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Insert assistant response
    insertChatMessage({
      action_id: actionId,
      role: 'assistant',
      content: assistantResponse
    });

    // Update action state to 'in_progress' if it was 'open'
    let updatedState = action.state;
    if (action.state === 'open') {
      updateActionState(actionId, 'in_progress');
      updatedState = 'in_progress';
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        updated_state: updatedState
      })
    };

  } catch (error) {
    console.error('Error in action-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
