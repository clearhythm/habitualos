require('dotenv').config();
const { getAgentsByUserId } = require('./_services/db-agents.cjs');

/**
 * GET /api/agents-list?userId=u-abc123
 * Get all agents for a user (sorted by most recent first)
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
    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Get all agents for this user (already sorted by _updatedAt descending)
    const agents = await getAgentsByUserId(userId);

    // Convert Firestore Timestamps to ISO strings for frontend
    const agentsWithDates = agents.map(agent => ({
      ...agent,
      _createdAt: agent._createdAt?.toDate ? agent._createdAt.toDate().toISOString() : agent._createdAt,
      _updatedAt: agent._updatedAt?.toDate ? agent._updatedAt.toDate().toISOString() : agent._updatedAt,
      metrics: agent.metrics ? {
        ...agent.metrics,
        lastRunAt: agent.metrics.lastRunAt // Already ISO string
      } : agent.metrics
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        agents: agentsWithDates
      })
    };

  } catch (error) {
    console.error('Error in agents-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
