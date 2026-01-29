require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getProjectsByUserId } = require('./_services/db-projects.cjs');
const { getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { getAgentsByUserId } = require('./_services/db-agents.cjs');
const { getActionsByUserId } = require('./_services/db-actions.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/do-chat
 * Executive Assistant chat endpoint - helps user focus and prioritize
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
    const { userId, message, chatHistory = [], timezone = 'America/Los_Angeles' } = JSON.parse(event.body);

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

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Message is required'
        })
      };
    }

    // Fetch all context for the EA
    const [projects, agents, allActions, workLogs] = await Promise.all([
      getProjectsByUserId(userId),
      getAgentsByUserId(userId),
      getActionsByUserId(userId),
      getWorkLogsByUserId(userId)
    ]);

    // Filter to open actions only
    const openActions = allActions.filter(a =>
      ['defined', 'scheduled', 'in_progress'].includes(a.state)
    );

    // Get recent work logs (last 10)
    const recentWorkLogs = workLogs.slice(0, 10);

    // Get active agents (excluding any "executive" type)
    const activeAgents = agents.filter(a => a.status === 'active' && a.type !== 'executive');

    // Build context strings
    const projectsContext = projects.length > 0
      ? projects.map(p => `- ${p.name}: ${p.goal || 'No goal set'}`).join('\n')
      : 'No projects yet';

    const agentsContext = activeAgents.length > 0
      ? activeAgents.map(a => `- ${a.name}: ${a.instructions?.goal || 'No goal'}`).join('\n')
      : 'No active agents';

    // Group actions by agent
    const actionsByAgent = {};
    openActions.forEach(a => {
      const agentName = agents.find(ag => ag.id === a.agentId)?.name || 'Unassigned';
      if (!actionsByAgent[agentName]) actionsByAgent[agentName] = [];
      actionsByAgent[agentName].push({
        id: a.id,
        title: a.title,
        priority: a.priority || 'normal',
        state: a.state
      });
    });

    const workLogsContext = recentWorkLogs.length > 0
      ? recentWorkLogs.map(w => {
          const projectName = w.projectId
            ? projects.find(p => p.id === w.projectId)?.name || 'Unknown project'
            : null;
          return `- ${w.title}${projectName ? ` (${projectName})` : ''}`;
        }).join('\n')
      : 'No recent work logged';

    // Get current time in user's timezone
    const now = new Date();
    const timeOfDay = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone
    });

    const dayOfWeek = now.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: timezone
    });

    // Build system prompt
    const systemPrompt = `You are an Executive Assistant with visibility across all projects and work.

YOUR STANCE (critical):
- Observational, not directive: "I notice...", "I see...", "What I'm observing..."
- Calm, present, reflective
- Brief responses (2-3 sentences unless more is needed)
- Never cheerleading or pressuring
- Help the user notice patterns they might miss
- When they seem overwhelmed, help narrow to ONE thing

CURRENT TIME: ${timeOfDay}, ${dayOfWeek}

WHAT YOU SEE:

Projects:
${projectsContext}

Active Agents (tactical workers that can do autonomous work):
${agentsContext}

Open Actions (${openActions.length} total):
${Object.keys(actionsByAgent).length > 0 ? JSON.stringify(actionsByAgent, null, 2) : 'None'}

Recent Work (what they've been doing):
${workLogsContext}

YOUR CAPABILITIES:
- Notice patterns across projects (overlap, imbalance, neglect)
- Help prioritize when asked - but through questions, not mandates
- Surface what seems most alive or urgent
- Ask about energy level to calibrate suggestions
- Help them decide what to work on next

CONVERSATIONAL APPROACH:
- If this is the start of a conversation, open with a brief observation about what you see, then ask an open question
- Good openers: "What feels most alive right now?", "Where's your energy today?", "I notice [pattern] - how does that land?"
- When overwhelmed, help narrow to ONE thing
- Respect "later" - don't pressure immediate action
- Trust them to know what they need - your job is to help them see clearly

IMPORTANT: You are NOT here to manage tasks or create to-do lists. You're here to help them focus and see what matters right now.`;

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
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        usage: {
          inputTokens: apiResponse.usage?.input_tokens,
          outputTokens: apiResponse.usage?.output_tokens
        }
      })
    };

  } catch (error) {
    console.error('Error in do-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
