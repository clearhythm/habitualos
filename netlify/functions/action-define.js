require('dotenv').config();
const { getAgent } = require('./_services/db-agents.cjs');
const { createAction, getAction } = require('./_services/db-actions.cjs');
const { getProject } = require('./_services/db-projects.cjs');
const { generateActionId } = require('./_utils/data-utils.cjs');

/**
 * POST /api/action-define
 *
 * Persist a draft action to Firestore (transition from "draft" to "defined" state).
 * See: docs/endpoints/action-define.md
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
    const { userId, agentId, title, description, priority, taskType, taskConfig, type, content, projectId, dueDate } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Valid userId is required'
        })
      };
    }

    if (!title) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'title is required'
        })
      };
    }

    // Require at least agentId or projectId
    if (!agentId && !projectId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Either agentId or projectId is required'
        })
      };
    }

    // Verify agent ownership if agentId provided
    if (agentId) {
      const agent = await getAgent(agentId);
      if (!agent || agent._userId !== userId) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: 'Agent not found or access denied'
          })
        };
      }
    }

    // Validate projectId ownership if provided
    if (projectId) {
      const project = await getProject(projectId);
      if (!project || project._userId !== userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ success: false, error: 'Invalid project' })
        };
      }
    }

    // Create action in Firestore
    const actionId = generateActionId();

    const actionData = {
      _userId: userId,
      agentId: agentId || null,
      projectId: projectId || null,
      title,
      description: description || '',
      state: 'open',  // State is 'open' - ready for scheduling
      priority: priority || 'medium',
      taskType: taskType || 'scheduled',
      assignedTo: 'user',  // default to user assignment
      taskConfig: taskConfig || {},
      scheduleTime: null,
      dueDate: dueDate || null,
      startedAt: null,
      completedAt: null,
      dismissedAt: null,
      dismissedReason: null,
      errorMessage: null,
      // For manual actions (formerly assets): type and content
      type: type || null,
      content: content || null
    };

    await createAction(actionId, actionData);

    // Fetch the created action
    const createdAction = await getAction(actionId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: createdAction
      })
    };

  } catch (error) {
    console.error('Error in action-define:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
