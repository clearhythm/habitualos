require('dotenv').config();
const { getActionsByUserId, getActionsByAgent } = require('./_services/db-actions.cjs');

/**
 * GET /api/actions?userId=u-abc123&agentId=agent-xyz (optional)
 * Get all actions for a user, optionally filtered by agent
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

    // Get actions (filtered by agent if specified)
    let actions;
    if (agentId) {
      actions = await getActionsByAgent(agentId, userId);
    } else {
      actions = await getActionsByUserId(userId);
    }

    // Convert Firestore Timestamps to ISO strings
    const actionsWithDates = actions.map(action => ({
      ...action,
      _createdAt: action._createdAt?.toDate ? action._createdAt.toDate().toISOString() : action._createdAt,
      _updatedAt: action._updatedAt?.toDate ? action._updatedAt.toDate().toISOString() : action._updatedAt,
      startedAt: action.startedAt, // Already ISO string
      completedAt: action.completedAt, // Already ISO string
      dismissedAt: action.dismissedAt // Already ISO string
    }));

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        actions: actionsWithDates
      })
    };

  } catch (error) {
    console.error('Error in actions-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
