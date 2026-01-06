require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { generateActionChatId } = require('./_utils/data-utils.cjs');
const { getAction, updateActionState, recordApiCall } = require('./_services/db-actions.cjs');
const { getAgent, updateAgent } = require('./_services/db-agents.cjs');
const { getChatMessagesByAction, createChatMessage } = require('./_services/db-action-chats.cjs');
const { createApiCallRecord } = require('./_utils/metrics-calculator.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/action/:id/chat?userId=u-abc123
 * Send user message, get AI response with metrics tracking
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
    // Extract action ID from path (last part of path)
    const pathParts = event.path.split('/').filter(p => p);
    const actionId = pathParts[pathParts.length - 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Get userId from query parameters
    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
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
    const action = await getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Verify action belongs to user
    if (action._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Insert user message
    const userMessageId = generateActionChatId();
    await createChatMessage(userMessageId, {
      _userId: userId,
      actionId: actionId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Get full chat history (including the new message)
    const chatHistory = await getChatMessagesByAction(actionId, userId);

    // Check if this is the North Star definition action
    const isNorthStarDefinition = action.title === 'Define Your North Star Goal';

    let apiResponse;
    let assistantResponse;

    if (isNorthStarDefinition) {
      // Special handling for North Star definition
      const conversationHistory = chatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      const systemPrompt = `You are a helpful AI assistant guiding a user to create their North Star goal in HabitualOS. Your job is to:

1. Help them articulate a clear, specific goal
2. Ensure it follows SMART principles (Specific, Measurable, Achievable, Relevant, Time-bound)
3. Extract success criteria (concrete milestones that indicate completion)
4. Determine a realistic timeline

Be conversational and helpful. Ask follow-up questions to refine vague goals. When you have enough information to create a well-defined North Star, you MUST respond with a special format.

**Response Format:**

If MORE information is needed, respond conversationally to guide the user.

If you have ENOUGH information (clear goal, success criteria, timeline), respond with:
READY_TO_CREATE
---
TITLE: [A concise title for the goal]
GOAL: [Full description of what they want to achieve]
SUCCESS_CRITERIA:
- [Criterion 1]
- [Criterion 2]
- [Criterion 3]
TIMELINE: [When they want to complete this by]`;

      apiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: conversationHistory
      });

      assistantResponse = apiResponse.content[0].text;

      // Check if ready to create North Star
      if (assistantResponse.startsWith('READY_TO_CREATE')) {
        // Parse the structured data (same parsing logic as setup-chat)
        const lines = assistantResponse.split('\n');
        let title = '';
        let goal = '';
        let successCriteria = [];
        let timeline = '';
        let currentSection = null;
        let criteriaLines = [];

        for (let i = 2; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('TITLE:')) {
            currentSection = 'title';
            title = line.substring(6).trim();
          } else if (line.startsWith('GOAL:')) {
            currentSection = 'goal';
            goal = line.substring(5).trim();
          } else if (line.startsWith('SUCCESS_CRITERIA:')) {
            currentSection = 'criteria';
          } else if (line.startsWith('TIMELINE:')) {
            currentSection = 'timeline';
            timeline = line.substring(9).trim();
          } else if (currentSection === 'goal' && line.trim()) {
            goal += ' ' + line.trim();
          } else if (currentSection === 'criteria' && line.trim().startsWith('-')) {
            criteriaLines.push(line.trim().substring(1).trim());
          } else if (currentSection === 'timeline' && line.trim()) {
            timeline += ' ' + line.trim();
          }
        }

        successCriteria = criteriaLines;

        // Update the Agent (replaces North Star)
        await updateAgent(action.agentId, {
          name: title.trim(),
          instructions: {
            goal: goal.trim(),
            success_criteria: successCriteria,
            timeline: timeline.trim(),
            format: 'northstar'
          }
        });

        // Mark action as completed
        await updateActionState(actionId, 'completed', {
          completedAt: new Date().toISOString()
        });

        // Store a user-friendly response
        assistantResponse = "Perfect! I've defined your North Star goal. Your agent will now start generating actions to help you achieve it.";
      }
    } else {
      // Regular action chat
      const chatPrompt = `You are an AI agent helping refine an actionable task.

Action: ${action.title}
Description: ${action.description}

Conversation history:
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's latest message: ${message}

Respond helpfully to refine the action. Be concise and actionable.`;

      apiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: chatPrompt
        }]
      });

      assistantResponse = apiResponse.content[0].text;
    }

    // Insert assistant response
    const assistantMessageId = generateActionChatId();
    await createChatMessage(assistantMessageId, {
      _userId: userId,
      actionId: actionId,
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date().toISOString()
    });

    // Record API call metrics
    const apiCallRecord = createApiCallRecord(
      'claude-sonnet-4-20250514',
      apiResponse.usage.input_tokens,
      apiResponse.usage.output_tokens,
      'chat'
    );
    await recordApiCall(actionId, apiCallRecord);

    // Update action state to 'in_progress' if it was 'open'
    let updatedState = action.state;
    if (action.state === 'open' && !isNorthStarDefinition) {
      await updateActionState(actionId, 'in_progress', {
        startedAt: new Date().toISOString()
      });
      updatedState = 'in_progress';
    } else if (assistantResponse.includes("I've defined your North Star goal")) {
      updatedState = 'completed';
    } else {
      updatedState = action.state;
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
        updated_state: updatedState,
        north_star_updated: assistantResponse.includes("I've defined your North Star goal")
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
