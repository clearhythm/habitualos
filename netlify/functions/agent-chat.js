require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('./_services/db-agents.cjs');
const { generateActionId } = require('./_utils/data-utils.cjs');
const { createAction } = require('./_services/db-actions.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/agent-chat
 * Conversational interface for agent to gather context and generate deliverables
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
    const { userId, agentId, message, chatHistory = [] } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Valid userId is required'
        })
      };
    }

    if (!agentId || !message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'agentId and message are required'
        })
      };
    }

    // Fetch agent details
    const agent = await getAgent(agentId);
    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found or access denied'
        })
      };
    }

    // Build system prompt
    const systemPrompt = `You're an autonomous agent helping someone achieve their goal. You do ALL the work - they just provide context.

Your role:
- Gather context needed to create deliverables
- Generate actionable deliverables you will create (not tasks for them to do)
- Suggest scheduling for when you'll do the work
- Eventually: proactively suggest embodiment practices that support their goal

Your voice:
- Brief responses (2-3 sentences, match their length)
- Forward-leaning and helpful
- Use present tense
- NOT cheerleading - just clear, practical help

Agent details:
- Name: ${agent.name}
- North Star Goal: ${agent.instructions?.goal || 'Not yet defined'}
- Success Criteria: ${JSON.stringify(agent.instructions?.success_criteria || [])}
- Timeline: ${agent.instructions?.timeline || 'Not specified'}

When to generate actions:
- When user asks for actions ("generate actions", "what should we start with", etc.)
- When you have enough context to create specific deliverables
- IMPORTANT: Actions are deliverables YOU will create, not todos for the user

If generating actions, respond with:
GENERATE_ACTIONS
---
[
  {
    "title": "Deliverable title",
    "description": "What you'll create and how",
    "priority": "high|medium|low"
  }
]

Otherwise, respond conversationally to gather context or answer questions.`;

    // Build conversation history for Claude
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Call Claude API
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: conversationHistory
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Check if response indicates action generation
    if (assistantResponse.startsWith('GENERATE_ACTIONS')) {
      // Parse the generated actions
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('[')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse action generation response'
          })
        };
      }

      const jsonContent = lines.slice(jsonStart).join('\n');
      let generatedActions = [];

      try {
        generatedActions = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse generated actions:', parseError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response'
          })
        };
      }

      // Create actions in Firestore
      for (const generatedAction of generatedActions) {
        const actionId = generateActionId();
        await createAction(actionId, {
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
      }

      // Return conversational confirmation
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `I've created ${generatedActions.length} deliverable${generatedActions.length > 1 ? 's' : ''} for you to review. I'll work on these to create the actual content. Want me to schedule when I should tackle each one?`,
          actionsGenerated: true
        })
      };
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        actionsGenerated: false
      })
    };

  } catch (error) {
    console.error('Error in agent-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
