require('dotenv').config();
const { getTimeEntry, deleteTimeEntry, getTotalTimeForAction } = require('./_services/db-action-time-entries.cjs');

/**
 * POST /api/action-time-entry-delete
 *
 * Delete a time entry.
 * Request: { userId, entryId }
 * Response: { success: true, totalMinutes: number }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, entryId } = JSON.parse(event.body);

    // Validate required fields
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!entryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'entryId is required' })
      };
    }

    // Get time entry and verify ownership
    const entry = await getTimeEntry(entryId);

    if (!entry) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Time entry not found' })
      };
    }

    if (entry._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Store actionId before deletion for total calculation
    const actionId = entry.actionId;

    // Delete the time entry
    await deleteTimeEntry(entryId);

    // Get updated total
    const totalMinutes = await getTotalTimeForAction(actionId, userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        totalMinutes
      })
    };

  } catch (error) {
    console.error('Error in action-time-entry-delete:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
