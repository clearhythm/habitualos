require('dotenv').config();
const {
  getActiveNorthStar,
  insertNorthStar,
  insertActionCard,
  getAllActions
} = require('../../db/helpers');

/**
 * GET /api/northstar-get
 * Get the active North Star (PoC assumes single North Star)
 * Auto-creates draft North Star and setup action on first load
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
    // Get active North Star
    let northstar = getActiveNorthStar();

    // If no North Star exists, auto-create an undefined one with setup action
    if (!northstar) {
      // Create undefined North Star (not yet defined by user)
      northstar = insertNorthStar({
        title: null,
        goal: null,
        success_criteria: [],
        timeline: null
      });

      // Create the setup action
      const setupAction = insertActionCard({
        north_star_id: northstar.id,
        title: 'Define Your North Star Goal',
        description: 'Let\'s work together to define what you want to accomplish. I\'ll help you create a clear, actionable goal.',
        priority: 'high'
      });

      // Return both North Star and the setup action ID
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          northstar: northstar,
          setupActionId: setupAction.id
        })
      };
    }

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
