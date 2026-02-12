require('dotenv').config();
const { createSurveyResponse, markActionCompleted } = require('@habitualos/survey-engine');
const { uniqueId } = require('@habitualos/db-core');

/**
 * POST /api/survey-measurement-save
 *
 * Saves a weekly survey response from a STORE_MEASUREMENT signal.
 * Marks the user as completed in the survey action.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, signal } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!signal || !signal.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Signal data is required' })
      };
    }

    const { dimensions, surveyActionId } = signal.data;

    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Dimensions array is required' })
      };
    }

    // Validate each dimension has name and score
    for (const dim of dimensions) {
      if (!dim.name || typeof dim.score !== 'number') {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: 'Each dimension needs name and numeric score' })
        };
      }
    }

    // Build scores in the survey-responses format
    // Agent emits 0-10 verbal scores; normalize to percentage (0-100)
    const scores = dimensions.map(d => ({
      dimension: d.name,
      average: d.score,
      score: (d.score / 10) * 100,
      notes: d.notes || null
    }));

    // Save survey response
    const responseId = `sr-${Date.now()}-${uniqueId(6)}`;
    await createSurveyResponse(responseId, {
      _userId: userId,
      surveyDefinitionId: 'survey-rel-v1',
      type: 'weekly',
      scores,
      surveyActionId: surveyActionId || null
    });

    // Mark survey action as completed
    let actionUpdate = null;
    if (surveyActionId) {
      actionUpdate = await markActionCompleted(surveyActionId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        responseId,
        actionCompleted: actionUpdate?.state === 'completed',
        message: 'Survey response saved'
      })
    };

  } catch (error) {
    console.error('[survey-measurement-save] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to save survey response' })
    };
  }
};
