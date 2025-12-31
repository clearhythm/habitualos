require('dotenv').config();
const { getRecentPractices } = require('../../db/helpers');

/**
 * GET /api/practices
 * Get list of recent practices
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
    // Get limit from query params (default 50)
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit)
      : 50;

    // Get recent practices
    const practices = getRecentPractices(limit);

    // Return success
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        practices
      })
    };

  } catch (error) {
    console.error('Error in practice-list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
