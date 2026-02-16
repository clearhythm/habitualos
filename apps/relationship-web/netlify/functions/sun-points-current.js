require('dotenv').config();
const { getCurrentPoints } = require('./_services/db-sun-points.cjs');

/**
 * GET /api/sun-points-current
 *
 * Returns the current sun points state.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const points = await getCurrentPoints();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        totalPoints: points.totalPoints || 0,
        erik: points.erik || 0,
        marta: points.marta || 0
      })
    };

  } catch (error) {
    console.error('[sun-points-current] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get sun points' })
    };
  }
};
