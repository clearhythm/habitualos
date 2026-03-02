require('dotenv').config();
const { createSurveyResponse, markActionCompleted } = require('@habitualos/survey-engine');

const SURVEY_ID = 'survey-obi-v1';

function uniqueId(len) {
  return Math.random().toString(36).substring(2, 2 + len);
}

/**
 * POST /api/survey-measurement-save
 *
 * Saves a daily challenge check-in response.
 * Body: { userId, signal: { type, data: { surveyActionId, dimensions: [{ name, score, notes }] } } }
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

    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!signal?.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Signal data is required' })
      };
    }

    const { dimensions, surveyActionId } = signal.data;

    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'dimensions array is required' })
      };
    }

    for (const dim of dimensions) {
      if (!dim.name || typeof dim.score !== 'number' || dim.score < 1 || dim.score > 5) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: `Invalid dimension: ${dim.name} — score must be 1–5` })
        };
      }
    }

    // Normalize 1–5 to 0–100%
    const scores = dimensions.map(d => ({
      dimension: d.name,
      average: d.score,
      score: (d.score / 5) * 100,
      notes: d.notes || null
    }));

    const responseId = `sr-${Date.now()}-${uniqueId(6)}`;
    await createSurveyResponse(responseId, {
      _userId: userId,
      surveyDefinitionId: SURVEY_ID,
      type: 'daily',
      _createdAt: new Date().toISOString(),
      scores,
      surveyActionId: surveyActionId || null
    });

    if (surveyActionId) {
      await markActionCompleted(surveyActionId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, responseId })
    };

  } catch (error) {
    console.error('[survey-measurement-save] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to save check-in' })
    };
  }
};
