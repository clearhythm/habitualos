require('dotenv').config();
const {
  getAction,
  updateActionState,
  insertChatMessage
} = require('../../db/helpers');

/**
 * POST /api/action/:id/dismiss
 * Dismiss ActionCard with reason
 */
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Extract action ID from path
    const pathParts = event.path.split('/');
    const actionId = pathParts[pathParts.indexOf('action') + 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Parse request body
    const { reason } = JSON.parse(event.body);

    if (!reason || !reason.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Dismissal reason is required'
        })
      };
    }

    // Check if action exists
    const action = getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Insert dismissal reason as system message in chat
    insertChatMessage({
      action_id: actionId,
      role: 'user',
      content: `[DISMISSED] ${reason}`
    });

    // Update action state to dismissed
    const updatedAction = updateActionState(actionId, 'dismissed', {
      dismissed_reason: reason
    });

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: updatedAction
      })
    };

  } catch (error) {
    console.error('Error in action-dismiss:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
