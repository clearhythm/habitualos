require('dotenv').config();
const {
  getAction,
  getChatMessages,
  getArtifacts
} = require('../../db/helpers');

/**
 * GET /api/action/:id
 * Get ActionCard details + chat history + artifacts
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
    // Extract action ID from path
    const pathParts = event.path.split('/');
    const actionId = pathParts[pathParts.length - 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Get action details
    const action = getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Get chat history
    const chat = getChatMessages(actionId);

    // Get artifacts
    const artifacts = getArtifacts(actionId);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: action,
        chat: chat,
        artifacts: artifacts
      })
    };

  } catch (error) {
    console.error('Error in action-get:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
