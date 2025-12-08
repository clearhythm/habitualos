require('dotenv').config();
const { getActiveNorthStar } = require('../../db/helpers');

/**
 * GET /api/northstar/get
 * Get the active NorthStar (PoC assumes single NorthStar)
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
    // Get active NorthStar
    const northstar = getActiveNorthStar();

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        northstar: northstar
      })
    };

  } catch (error) {
    console.error('Error in northstar-get:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
