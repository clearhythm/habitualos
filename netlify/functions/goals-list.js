require('dotenv').config();
const { getGoalsByProject, getGoalProgress } = require('./_services/db-goals.cjs');
const { getProject } = require('./_services/db-projects.cjs');

/**
 * GET /api/goals-list?userId=xxx&projectId=xxx
 *
 * List all goals for a project with progress info.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, projectId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate projectId
    if (!projectId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'projectId is required' })
      };
    }

    // Verify project ownership
    const project = await getProject(projectId);
    if (!project || project._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Invalid project' })
      };
    }

    // Get goals for project
    const goals = await getGoalsByProject(projectId, userId);

    // Add progress to each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await getGoalProgress(goal.id, userId);
        return {
          ...goal,
          progress,
          _createdAt: goal._createdAt?.toDate?.()
            ? goal._createdAt.toDate().toISOString()
            : goal._createdAt,
          _updatedAt: goal._updatedAt?.toDate?.()
            ? goal._updatedAt.toDate().toISOString()
            : goal._updatedAt
        };
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        goals: goalsWithProgress,
        count: goalsWithProgress.length
      })
    };

  } catch (error) {
    console.error('Error in goals-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
