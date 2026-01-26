require('dotenv').config();
const { getFeedbackByAgent } = require('./_services/db-user-feedback.cjs');

/**
 * POST /api/user-feedback-list
 *
 * List feedback for an agent.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, limit } = JSON.parse(event.body);

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

    // Get feedback
    const parsedLimit = (limit && typeof limit === 'number' && limit > 0) ? limit : undefined;
    const feedback = await getFeedbackByAgent(agentId, userId, parsedLimit);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, feedback })
    };

  } catch (error) {
    console.error('Error in user-feedback-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
