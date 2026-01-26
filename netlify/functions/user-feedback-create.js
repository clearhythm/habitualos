require('dotenv').config();
const { createFeedback } = require('./_services/db-user-feedback.cjs');

/**
 * POST /api/user-feedback-create
 *
 * Submit feedback for an agent draft.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, draftId, type, score, feedback, status, user_tags } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate agentId
    if (!agentId || typeof agentId !== 'string' || !agentId.startsWith('agent-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid agentId is required' })
      };
    }

    // Validate draftId
    if (!draftId || typeof draftId !== 'string' || !draftId.startsWith('draft-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid draftId is required' })
      };
    }

    // Validate type
    if (!type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'type is required' })
      };
    }

    // Build feedback data
    const feedbackData = {
      _userId: userId,
      agentId,
      draftId,
      type
    };
    if (score !== undefined) feedbackData.score = score;
    if (feedback !== undefined) feedbackData.feedback = feedback;
    if (status !== undefined) feedbackData.status = status;
    if (user_tags !== undefined) feedbackData.user_tags = user_tags;

    // Create feedback
    const result = await createFeedback(feedbackData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, feedback: result })
    };

  } catch (error) {
    console.error('Error in user-feedback-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
