require('dotenv').config();
const { getAllActions } = require('../../db/helpers');

/**
 * GET /api/actions
 * Get all ActionCards (PoC has single NorthStar)
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
    // Get all actions
    const actions = getAllActions();

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        actions: actions
      })
    };

  } catch (error) {
    console.error('Error in actions-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
