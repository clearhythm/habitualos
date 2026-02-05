require('dotenv').config();
const { getWorkLogsByUserId, getWorkLogsByProject, getWorkLogCount } = require('./_services/db-work-logs.cjs');

/**
 * GET /api/work-log-list?userId=u-abc123&projectId=project-xyz (optional)
 * Get work logs for a user, optionally filtered by project
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
    const { userId, projectId, limit } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Get work logs - filtered by project if specified
    let workLogs;
    if (projectId && projectId.startsWith('project-')) {
      workLogs = await getWorkLogsByProject(projectId, userId);
    } else {
      workLogs = await getWorkLogsByUserId(userId);
    }

    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        workLogs = workLogs.slice(0, limitNum);
      }
    }

    // Convert Firestore Timestamps to ISO strings for frontend
    const workLogsWithDates = workLogs.map(log => ({
      ...log,
      _createdAt: log._createdAt?.toDate ? log._createdAt.toDate().toISOString() : log._createdAt
    }));

    // Get total count (unfiltered)
    const totalCount = await getWorkLogCount(userId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        workLogs: workLogsWithDates,
        count: workLogsWithDates.length,
        totalCount
      })
    };

  } catch (error) {
    console.error('Error in work-log-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
