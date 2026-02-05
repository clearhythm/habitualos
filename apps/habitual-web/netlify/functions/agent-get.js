require('dotenv').config();
const { generateAgentId, generateActionId } = require('./_utils/data-utils.cjs');
const { getAgent, getAgentsByUserId, createAgent } = require('./_services/db-agents.cjs');
const { createAction } = require('./_services/db-actions.cjs');

/**
 * GET /api/agent-get?userId=u-abc123&agentId=agent-xyz (optional)
 * Get a specific agent by ID, or get the active/most recent agent
 * Auto-creates default agent and setup action on first load
 */
exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // If agentId specified, get that specific agent
    if (agentId) {
      const agent = await getAgent(agentId);

      if (!agent) {
        return {
          statusCode: 404,
          body: JSON.stringify({ success: false, error: 'Agent not found' })
        };
      }

      // Verify agent belongs to user
      if (agent._userId !== userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
      }

      // Convert Firestore Timestamps to ISO strings
      const agentWithDates = convertTimestamps(agent);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          agent: agentWithDates
        })
      };
    }

    // Get all agents for user
    let agents = await getAgentsByUserId(userId);

    // If no agents exist, auto-create default agent with setup action
    if (!agents || agents.length === 0) {
      const agentId = generateAgentId();
      const actionId = generateActionId();

      // Create default agent
      const newAgent = await createAgent(agentId, {
        _userId: userId,
        type: 'northstar',
        name: 'Untitled Goal',
        status: 'active',
        instructions: {
          goal: 'Not yet defined',
          success_criteria: [],
          timeline: null,
          format: 'northstar'
        }
      });

      // Create setup action
      const setupAction = await createAction(actionId, {
        _userId: userId,
        agentId: newAgent.id,
        title: 'Define Your North Star Goal',
        description: 'Let\'s work together to define what you want to accomplish. I\'ll help you create a clear, actionable goal.',
        state: 'open',
        priority: 'high',
        taskType: 'interactive',
        scheduleTime: null,
        taskConfig: {}
      });

      // Get the newly created agent
      const agent = await getAgent(newAgent.id);
      const agentWithDates = convertTimestamps(agent);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          agent: agentWithDates,
          setupActionId: setupAction.id
        })
      };
    }

    // Get active agent or most recent one
    const activeAgent = agents.find(a => a.status === 'active') || agents[0];
    const agentWithDates = convertTimestamps(activeAgent);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        agent: agentWithDates
      })
    };

  } catch (error) {
    console.error('Error in agent-get:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

/**
 * Convert Firestore Timestamps to ISO strings
 */
function convertTimestamps(obj) {
  if (!obj) return obj;

  return {
    ...obj,
    _createdAt: obj._createdAt?.toDate ? obj._createdAt.toDate().toISOString() : obj._createdAt,
    _updatedAt: obj._updatedAt?.toDate ? obj._updatedAt.toDate().toISOString() : obj._updatedAt,
    metrics: obj.metrics ? {
      ...obj.metrics,
      lastRunAt: obj.metrics.lastRunAt // Already ISO string
    } : obj.metrics
  };
}
