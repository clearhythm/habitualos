require('dotenv').config();
const { updatePracticeLogFeedback } = require('./_services/db-practice-logs.cjs');

/**
 * POST /api/practice/feedback
 * Update practice feedback (thumbs up/down)
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
    // Parse request body
    const { id, feedback } = JSON.parse(event.body);

    if (!id || !feedback) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Practice ID and feedback are required'
        })
      };
    }

    if (feedback !== 'thumbs_up' && feedback !== 'thumbs_down') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Feedback must be thumbs_up or thumbs_down'
        })
      };
    }

    // Update feedback
    await updatePracticeLogFeedback(id, feedback);
    const result = { id, feedback };

    // Return success
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        result
      })
    };

  } catch (error) {
    console.error('Error in practice-feedback:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
