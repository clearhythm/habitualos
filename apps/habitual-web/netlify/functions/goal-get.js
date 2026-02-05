require('dotenv').config();
const { getGoal, getGoalActions, getGoalProgress } = require('./_services/db-goals.cjs');
const { getProject } = require('./_services/db-projects.cjs');

/**
 * GET /api/goal-get/:id?userId=xxx
 *
 * Get goal details with actions and progress.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Extract goalId from path
    const pathParts = event.path.split('/');
    const goalId = pathParts[pathParts.length - 1];

    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate goalId
    if (!goalId || goalId === 'goal-get') {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'goalId is required' })
      };
    }

    // Get goal
    const goal = await getGoal(goalId);
    if (!goal) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Goal not found' })
      };
    }

    // Verify ownership
    if (goal._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Access denied' })
      };
    }

    // Get project info
    const project = await getProject(goal.projectId);

    // Get actions and progress
    const actions = await getGoalActions(goalId, userId);
    const progress = await getGoalProgress(goalId, userId);

    // Convert timestamps
    const convertTimestamps = (obj) => ({
      ...obj,
      _createdAt: obj._createdAt?.toDate?.()
        ? obj._createdAt.toDate().toISOString()
        : obj._createdAt,
      _updatedAt: obj._updatedAt?.toDate?.()
        ? obj._updatedAt.toDate().toISOString()
        : obj._updatedAt
    });

    const goalResponse = convertTimestamps(goal);
    const actionsResponse = actions.map(convertTimestamps);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        goal: goalResponse,
        project: project ? { id: project.id, name: project.name } : null,
        actions: actionsResponse,
        progress
      })
    };

  } catch (error) {
    console.error('Error in goal-get:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
