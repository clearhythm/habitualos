require('dotenv').config();
const { generateWorkLogId } = require('./_utils/data-utils.cjs');
const { createWorkLog, getWorkLogCount } = require('./_services/db-work-logs.cjs');

/**
 * POST /api/work-log-submit
 * Submit a new work log entry
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
    const { userId, title, projectId, duration, reflection } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required field: title is required'
        })
      };
    }

    // Build work log data
    const workLogData = {
      _userId: userId,
      title: title.trim()
    };

    // Add optional fields if provided
    if (projectId && typeof projectId === 'string' && projectId.startsWith('project-')) {
      workLogData.projectId = projectId;
    }

    if (duration && typeof duration === 'number' && duration > 0) {
      workLogData.duration = duration;
    }

    if (reflection && typeof reflection === 'string' && reflection.trim().length > 0) {
      workLogData.reflection = reflection.trim();
    }

    // Create work log in Firestore
    const workLogId = generateWorkLogId();
    const result = await createWorkLog(workLogId, workLogData);

    // Get updated count for response
    const totalCount = await getWorkLogCount(userId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        workLog: {
          id: result.id,
          ...workLogData
        },
        totalCount
      })
    };

  } catch (error) {
    console.error('Error in work-log-submit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
