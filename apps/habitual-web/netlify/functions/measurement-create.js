require('dotenv').config();
const { getAction } = require('./_services/db-actions.cjs');
const { createMeasurement } = require('./_services/db-measurements.cjs');
const { generateMeasurementId } = require('./_utils/data-utils.cjs');

/**
 * POST /api/measurement-create
 *
 * Store a measurement check-in from agent chat.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, actionId, dimensions, notes } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate required fields
    if (!agentId || !actionId || !Array.isArray(dimensions) || dimensions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'agentId, actionId, and dimensions array are required'
        })
      };
    }

    // Validate dimensions structure
    for (const dim of dimensions) {
      if (!dim.name || typeof dim.score !== 'number') {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Each dimension must have name and numeric score'
          })
        };
      }
    }

    // Verify action exists and user owns it
    const action = await getAction(actionId);
    if (!action || action._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Action not found or access denied' })
      };
    }

    // Verify action belongs to the specified agent
    if (action.agentId !== agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Action does not belong to specified agent' })
      };
    }

    // Create measurement
    const measurementId = generateMeasurementId();
    const measurementData = {
      _userId: userId,
      agentId,
      actionId,
      timestamp: new Date().toISOString(),
      dimensions: dimensions.map(d => ({
        name: d.name,
        score: d.score,
        notes: d.notes || null
      })),
      notes: notes || null
    };

    await createMeasurement(measurementId, measurementData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        measurement: {
          id: measurementId,
          ...measurementData
        }
      })
    };

  } catch (error) {
    console.error('Error in measurement-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
