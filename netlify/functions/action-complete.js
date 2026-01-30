require('dotenv').config();
const { getAction, updateActionState, createAction } = require('./_services/db-actions.cjs');
const { incrementAgentActionCount } = require('./_services/db-agents.cjs');
const { generateActionId } = require('./_utils/data-utils.cjs');
const { createWorkLog, getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { shouldEAAppear, generateEAMessage } = require('./_utils/ea-appearance.cjs');

/**
 * POST /api/action/:id/complete?userId=u-abc123
 * Mark ActionCard as completed and update agent metrics
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

    // Update action state to completed
    await updateActionState(actionId, 'completed', {
      completedAt: new Date().toISOString()
    });

    // Increment agent's completedActions counter
    if (action.agentId) {
      await incrementAgentActionCount(action.agentId, 'completedActions', 1);

      // Decrement inProgressActions if it was in progress
      if (action.state === 'in_progress') {
        await incrementAgentActionCount(action.agentId, 'inProgressActions', -1);
      }
    }

    // Get recent logs for EA decision
    let recentLogs = [];
    let workLogCount = 0;
    try {
      recentLogs = await getWorkLogsByUserId(userId);
      workLogCount = recentLogs.length;
    } catch (error) {
      console.log('No existing work logs found');
    }

    // Check if EA should appear
    const { shouldAppear, reason } = shouldEAAppear(workLogCount, recentLogs);

    // Generate EA message if appearing
    let eaMessage = null;
    if (shouldAppear) {
      eaMessage = await generateEAMessage(reason, action.title, workLogCount);
    }

    // Create work-log entry for this completed action
    const workLogData = {
      _userId: userId,
      actionId: actionId,
      title: action.title
    };
    if (action.projectId) {
      workLogData.projectId = action.projectId;
    }
    if (action.agentId) {
      workLogData.agentId = action.agentId;
    }
    await createWorkLog(null, workLogData);

    // Check for recurrence configuration and create next instance
    if (action.taskConfig?.recurrence?.type === 'daily') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Preserve time from original scheduleTime or use configured time
      if (action.scheduleTime) {
        const orig = new Date(action.scheduleTime);
        tomorrow.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
      } else if (action.taskConfig.recurrence.time) {
        const [h, m] = action.taskConfig.recurrence.time.split(':').map(Number);
        tomorrow.setHours(h, m, 0, 0);
      }

      // Create new action with same config
      const newActionId = generateActionId();
      const newActionData = {
        _userId: action._userId,
        agentId: action.agentId,
        title: action.title,
        description: action.description,
        state: 'scheduled',
        priority: action.priority || 'medium',
        taskType: action.taskType,
        taskConfig: action.taskConfig,
        scheduleTime: tomorrow.toISOString(),
        startedAt: null,
        completedAt: null,
        dismissedAt: null,
        dismissedReason: null,
        errorMessage: null,
        type: action.type || null,
        content: action.content || null
      };

      await createAction(newActionId, newActionData);
      console.log(`[action-complete] Created recurring action ${newActionId} scheduled for ${tomorrow.toISOString()}`);
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
        action: actionWithDates,
        ea: shouldAppear ? { message: eaMessage } : null
      })
    };

  } catch (error) {
    console.error('Error in action-complete:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
