require('dotenv').config();
const { getAction } = require('./_services/db-actions.cjs');
const { createTimeEntry, getTotalTimeForAction } = require('./_services/db-action-time-entries.cjs');

/**
 * POST /api/action-time-entry-create
 *
 * Create a new time entry on an action.
 * Request: { userId, actionId, duration, note?, loggedAt? }
 * Response: { success: true, entry: { id, ... }, totalMinutes: number }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, actionId, duration, note, loggedAt } = JSON.parse(event.body);

    // Validate required fields
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'actionId is required' })
      };
    }

    if (!duration || typeof duration !== 'number' || duration <= 0 || !Number.isInteger(duration)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'duration must be a positive integer (minutes)' })
      };
    }

    // Verify action exists and belongs to user
    const action = await getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Action not found' })
      };
    }

    if (action._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Create the time entry
    const result = await createTimeEntry(null, {
      _userId: userId,
      actionId,
      duration,
      note: note ? note.trim() : null,
      loggedAt: loggedAt || new Date().toISOString()
    });

    // Get updated total
    const totalMinutes = await getTotalTimeForAction(actionId, userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        entry: {
          id: result.id,
          actionId,
          duration,
          note: note ? note.trim() : null,
          loggedAt: loggedAt || new Date().toISOString()
        },
        totalMinutes
      })
    };

  } catch (error) {
    console.error('Error in action-time-entry-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
