require('dotenv').config();
const { getAction, updateAction } = require('./_services/db-actions.cjs');
const { getProject } = require('./_services/db-projects.cjs');

/**
 * POST /api/action-update
 *
 * Update action fields (title, description, priority, projectId, taskConfig).
 * Does not handle state transitions - use action-complete, action-dismiss, etc.
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
    // Parse request body
    const { actionId, title, description, priority, projectId, taskConfig } = JSON.parse(event.body);

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

    // Check if action exists and belongs to user
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

    // Validate projectId ownership if provided (null is allowed to unassign)
    if (projectId !== undefined && projectId !== null) {
      const project = await getProject(projectId);
      if (!project || project._userId !== userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ success: false, error: 'Invalid project' })
        };
      }
    }

    // Build updates object (only include provided fields)
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (projectId !== undefined) updates.projectId = projectId;
    if (taskConfig !== undefined) updates.taskConfig = taskConfig;

    // Update action
    await updateAction(actionId, updates);

    // Get updated action
    const updatedAction = await getAction(actionId);

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
    console.error('Error in action-update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
