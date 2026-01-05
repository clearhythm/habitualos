require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { getAction, updateActionState } = require('./_services/db-actions.cjs');
const { createChatMessage } = require('./_services/db-action-chats.cjs');
const { incrementAgentActionCount } = require('./_services/db-agents.cjs');

/**
 * POST /api/action/:id/dismiss?userId=u-abc123
 * Dismiss ActionCard with reason and update agent metrics
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
    // Extract action ID from path (last part of path)
    const pathParts = event.path.split('/').filter(p => p);
    const actionId = pathParts[pathParts.length - 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Get userId from query parameters
    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
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
    const action = await getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Verify action belongs to user
    if (action._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Insert dismissal reason as system message in chat
    const messageId = crypto.randomUUID();
    await createChatMessage(messageId, {
      _userId: userId,
      actionId: actionId,
      role: 'user',
      content: `[DISMISSED] ${reason}`,
      timestamp: new Date().toISOString()
    });

    // Update action state to dismissed
    await updateActionState(actionId, 'dismissed', {
      dismissedReason: reason,
      dismissedAt: new Date().toISOString()
    });

    // Decrement inProgressActions if it was in progress
    if (action.agentId && action.state === 'in_progress') {
      await incrementAgentActionCount(action.agentId, 'inProgressActions', -1);
    }

    // Get updated action
    const updatedAction = await getAction(actionId);

    // Convert Firestore Timestamps
    const actionWithDates = {
      ...updatedAction,
      _createdAt: updatedAction._createdAt?.toDate ? updatedAction._createdAt.toDate().toISOString() : updatedAction._createdAt,
      _updatedAt: updatedAction._updatedAt?.toDate ? updatedAction._updatedAt.toDate().toISOString() : updatedAction._updatedAt,
      startedAt: updatedAction.startedAt,
      completedAt: updatedAction.completedAt,
      dismissedAt: updatedAction.dismissedAt
    };

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: actionWithDates
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
