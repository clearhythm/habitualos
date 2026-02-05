require('dotenv').config();
const { createDraft } = require('./_services/db-agent-drafts.cjs');

/**
 * POST /api/agent-drafts-create
 *
 * Create a new draft for an agent.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, type, data } = JSON.parse(event.body);

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

    // Validate required fields
    if (!type || !data || typeof data !== 'object') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: type and data are required'
        })
      };
    }

    // Create draft
    const draft = await createDraft({
      _userId: userId,
      agentId,
      type,
      data
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, draft })
    };

  } catch (error) {
    console.error('Error in agent-drafts-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
