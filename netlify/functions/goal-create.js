require('dotenv').config();
const { createGoal, getGoal } = require('./_services/db-goals.cjs');
const { getProject } = require('./_services/db-projects.cjs');
const { generateGoalId } = require('./_utils/data-utils.cjs');

/**
 * POST /api/goal-create
 *
 * Create a new goal under a project.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, projectId, title, description } = JSON.parse(event.body);

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

    // Validate title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'title is required' })
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

    // Create goal
    const goalId = generateGoalId();
    const goalData = {
      _userId: userId,
      projectId,
      title: title.trim(),
      description: description?.trim() || null,
      state: 'active'
    };

    await createGoal(goalId, goalData);

    // Fetch the created goal
    const createdGoal = await getGoal(goalId);

    // Convert timestamps for response
    const goalResponse = {
      ...createdGoal,
      _createdAt: createdGoal._createdAt?.toDate?.()
        ? createdGoal._createdAt.toDate().toISOString()
        : createdGoal._createdAt,
      _updatedAt: createdGoal._updatedAt?.toDate?.()
        ? createdGoal._updatedAt.toDate().toISOString()
        : createdGoal._updatedAt
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, goal: goalResponse })
    };

  } catch (error) {
    console.error('Error in goal-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
