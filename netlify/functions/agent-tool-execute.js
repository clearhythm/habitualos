require('dotenv').config();

const { getAgent } = require('./_services/db-agents.cjs');
const { log } = require('./_utils/log.cjs');
const { handleToolCall } = require('./_agent-core');

/**
 * POST /api/agent-tool-execute
 *
 * Executes a single tool call and returns the result.
 * Called by edge function during streaming to handle tool use.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, toolUse } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'agentId is required' })
      };
    }

    if (!toolUse || !toolUse.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'toolUse with name is required' })
      };
    }

    // Fetch agent for context (needed for filesystem tools)
    const agent = await getAgent(agentId);

    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Agent not found or access denied' })
      };
    }

    log('info', `[agent-tool-execute] Executing tool: ${toolUse.name}`, toolUse.input);

    // Execute the tool using shared handler
    const result = await handleToolCall(toolUse, userId, agentId, agent);

    log('info', `[agent-tool-execute] Tool result:`, result);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        result
      })
    };

  } catch (error) {
    log('error', '[agent-tool-execute] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
