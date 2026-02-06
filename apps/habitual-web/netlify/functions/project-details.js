require('dotenv').config();
const { getProject, getProjectAgents, getProjectActions } = require('./_services/db-projects.cjs');

/**
 * GET /api/project-details?userId=u-abc123&projectId=project-xyz
 *
 * Get a project with its rolled-up agents and actions.
 * Response: { success, project, agents, actions }
 */
exports.handler = async (event) => {
  // Only allow GET
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
    if (!projectId || typeof projectId !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'projectId is required' })
      };
    }

    const project = await getProject(projectId);

    if (!project) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Project not found' })
      };
    }

    // Verify project belongs to user
    if (project._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Get rolled-up agents and actions
    const agents = await getProjectAgents(projectId, userId);
    const actions = await getProjectActions(projectId, userId);

    // Helper to convert Firestore Timestamps to ISO strings
    const convertTimestamps = (doc) => ({
      ...doc,
      _createdAt: doc._createdAt?.toDate ? doc._createdAt.toDate().toISOString() : doc._createdAt,
      _updatedAt: doc._updatedAt?.toDate ? doc._updatedAt.toDate().toISOString() : doc._updatedAt
    });

    // Convert timestamps for project, agents, and actions
    const projectWithDates = convertTimestamps(project);
    const agentsWithDates = agents.map(convertTimestamps);
    const actionsWithDates = actions.map(convertTimestamps);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        project: projectWithDates,
        agents: agentsWithDates,
        actions: actionsWithDates
      })
    };

  } catch (error) {
    console.error('Error in project-details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
