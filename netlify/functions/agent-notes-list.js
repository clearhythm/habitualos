require('dotenv').config();
const { getNotesByAgent } = require('./_services/db-agent-notes.cjs');

/**
 * POST /api/agent-notes-list
 *
 * List notes for an agent with optional filters.
 * See: docs/endpoints/agent-notes.md
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, status, type, limit } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate agentId
    if (!agentId || typeof agentId !== 'string' || !agentId.startsWith('agent-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid agentId is required' })
      };
    }

    // Build filters
    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (limit && typeof limit === 'number' && limit > 0) filters.limit = limit;

    // Get notes
    const notes = await getNotesByAgent(agentId, userId, filters);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, notes })
    };

  } catch (error) {
    console.error('Error in agent-notes-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
