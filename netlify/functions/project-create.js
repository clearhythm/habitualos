require('dotenv').config();
const { generateProjectId } = require('./_utils/data-utils.cjs');
const { createProject } = require('./_services/db-projects.cjs');

/**
 * POST /api/project-create
 * Create a new project
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
    const { userId, name, description, success_criteria, timeline, status } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate required fields
    if (!name) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required field: name is required'
        })
      };
    }

    // Create project in Firestore
    const projectId = generateProjectId();
    const projectData = {
      _userId: userId,
      name,
      description: description || '',
      success_criteria: success_criteria || [],
      timeline: timeline || 'ongoing',
      status: status || 'open'
    };
    const result = await createProject(projectId, projectData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        project: {
          id: result.id,
          ...projectData
        }
      })
    };

  } catch (error) {
    console.error('Error in project-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
