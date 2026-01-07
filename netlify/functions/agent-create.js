require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { generateAgentId, generateActionId, generateAgentCreationChatId } = require('./_utils/data-utils.cjs');
const { createAgent } = require('./_services/db-agents.cjs');
const { createAction, recordApiCall } = require('./_services/db-actions.cjs');
const { createApiCallRecord } = require('./_utils/metrics-calculator.cjs');
const { createAgentCreationChat } = require('./_services/db-agent-creation-chats.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/agent-create
 * Create agent and generate initial actions via Claude API with metrics tracking
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
    const { userId, name, goal, success_criteria, timeline, type, chatHistory } = JSON.parse(event.body);

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
      }
    });

    // Generate actions via Claude API
    const generateActionsPrompt = `You are an AI agent helping a user achieve their goal.

NorthStar Goal: ${goal}
Success Criteria: ${JSON.stringify(success_criteria || [])}
Timeline: ${timeline || 'Not specified'}

Generate 3-5 high-priority, immediately actionable steps to move toward this goal.

Requirements for each action:
- Completable in 1-4 hours
- Has a clear deliverable/outcome
- Does not depend on other actions being completed first
- Specific and concrete (not vague)
- Focuses on tangible work product

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "Short, clear action title",
    "description": "Detailed description of what needs to be done and why",
    "priority": "high|medium|low"
  }
]

No preamble, no explanation, just the JSON array.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: generateActionsPrompt
      }]
    });

    // Parse Claude's response
    let generatedActions = [];
    try {
      const responseText = message.content[0].text;
      generatedActions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to parse AI response'
        })
      };
    }

    // Create actions in Firestore
    const actions = [];
    for (const generatedAction of generatedActions) {
      const actionId = generateActionId();
      const action = await createAction(actionId, {
        _userId: userId,
        agentId: agent.id,
        title: generatedAction.title,
        description: generatedAction.description,
        priority: generatedAction.priority || 'medium',
        state: 'open',
        taskType: 'interactive',
        scheduleTime: null,
        taskConfig: {}
      });

      // Track metrics for the initial action generation API call
      // We'll attribute the full API call to the first action
      if (actions.length === 0) {
        const apiCallRecord = createApiCallRecord(
          'claude-sonnet-4-20250514',
          message.usage.input_tokens,
          message.usage.output_tokens,
          'generate'
        );
        await recordApiCall(action.id, apiCallRecord);
      }

      actions.push({ id: action.id, ...generatedAction });
    }

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
        agent: { id: agent.id, name, goal, success_criteria, timeline, type: type || 'northstar' },
        actions: actions,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens
        }
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
