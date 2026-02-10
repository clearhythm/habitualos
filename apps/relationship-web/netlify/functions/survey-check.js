require('dotenv').config();
const { getOpenSurveyAction, hasUserCompleted } = require('@habitualos/survey-engine');

const SURVEY_DEFINITION_ID = 'survey-rel-v1';

/**
 * GET /api/survey-check?userId=u-...
 *
 * Lightweight check for whether the user has a pending survey.
 */
exports.handler = async (event) => {
  const userId = event.queryStringParameters?.userId;

  if (!userId || !userId.startsWith('u-')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Valid userId is required' })
    };
  }

  try {
    const openAction = await getOpenSurveyAction(SURVEY_DEFINITION_ID);
    if (!openAction) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSurvey: false })
      };
    }

    const completed = await hasUserCompleted(openAction.id, userId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasSurvey: !completed })
    };
  } catch (error) {
    console.error('[survey-check] ERROR:', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasSurvey: false })
    };
  }
};
