require('dotenv').config();
const { getGoal, updateGoal } = require('./_services/db-goals.cjs');

/**
 * POST /api/goal-update
 *
 * Update goal fields (title, description, state).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, goalId, title, description, state } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate goalId
    if (!goalId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'goalId is required' })
      };
    }

    // Verify goal exists and ownership
    const goal = await getGoal(goalId);
    if (!goal) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Goal not found' })
      };
    }

    if (goal._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Access denied' })
      };
    }

    // Build updates object (only include provided fields)
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (state !== undefined) {
      if (!['active', 'completed', 'archived'].includes(state)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: 'Invalid state. Must be active, completed, or archived' })
        };
      }
      updates.state = state;
    }

    // Update goal
    await updateGoal(goalId, updates);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error in goal-update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
