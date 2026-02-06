require('dotenv').config();
const { getProjectsByUserId } = require('./_services/db-projects.cjs');

/**
 * GET /api/projects-list?userId=u-abc123
 * Get all projects for a user
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
    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Get all projects for this user
    const projects = await getProjectsByUserId(userId);

    // Convert Firestore Timestamps to ISO strings for frontend
    const projectsWithDates = projects.map(project => ({
      ...project,
      _createdAt: project._createdAt?.toDate ? project._createdAt.toDate().toISOString() : project._createdAt,
      _updatedAt: project._updatedAt?.toDate ? project._updatedAt.toDate().toISOString() : project._updatedAt
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        projects: projectsWithDates,
        count: projectsWithDates.length
      })
    };

  } catch (error) {
    console.error('Error in projects-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
