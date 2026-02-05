require('dotenv').config();
const { getProject } = require('./_services/db-projects.cjs');

/**
 * GET /api/project-get?userId=u-abc123&projectId=project-xyz
 * Get a specific project by ID
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

    // Convert Firestore Timestamps to ISO strings
    const projectWithDates = {
      ...project,
      _createdAt: project._createdAt?.toDate ? project._createdAt.toDate().toISOString() : project._createdAt,
      _updatedAt: project._updatedAt?.toDate ? project._updatedAt.toDate().toISOString() : project._updatedAt
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        project: projectWithDates
      })
    };

  } catch (error) {
    console.error('Error in project-get:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
