require('dotenv').config();
const { createWorkLog, getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { shouldEAAppear, generateEAMessage } = require('./_utils/ea-appearance.cjs');

/**
 * POST /api/work-log-submit
 * Submit a new work log entry
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, title, projectId, duration } = JSON.parse(event.body);

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
        body: JSON.stringify({ success: false, error: 'Missing required field: title is required' })
      };
    }

    // Get recent logs for EA decision
    let recentLogs = [];
    let workLogCount = 0;
    try {
      recentLogs = await getWorkLogsByUserId(userId);
      workLogCount = recentLogs.length;
    } catch (error) {
      console.log('No existing work logs found');
    }

    // Check if EA should appear
    const { shouldAppear, reason } = shouldEAAppear(workLogCount, recentLogs);

    // Generate EA message if appearing
    let eaMessage = null;
    if (shouldAppear) {
      eaMessage = await generateEAMessage(reason, title, workLogCount);
    }

    // Build work log data
    const workLogData = {
      _userId: userId,
      title: title.trim()
    };

    if (projectId && typeof projectId === 'string' && projectId.startsWith('project-')) {
      workLogData.projectId = projectId;
    }

    if (duration && typeof duration === 'number' && duration > 0) {
      workLogData.duration = duration;
    }

    // Create work log
    const result = await createWorkLog(null, workLogData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        workLog: { id: result.id, ...workLogData },
        ea: shouldAppear ? { message: eaMessage } : null
      })
    };

  } catch (error) {
    console.error('Error in work-log-submit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
