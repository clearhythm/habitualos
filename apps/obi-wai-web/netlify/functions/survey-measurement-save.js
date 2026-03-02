require('dotenv').config();
const { createSurveyResponse, markActionCompleted } = require('@habitualos/survey-engine');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

const SURVEY_ID = 'survey-obi-v1';

function uniqueId(len) {
  return Math.random().toString(36).substring(2, 2 + len);
}

function toPacificDate(ts) {
  const parts = new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }).split(',')[0].trim().split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
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

    // Auto-tag timing based on practices logged today at save time
    const now = new Date();
    const todayPT = toPacificDate(now);
    const allLogs = await getPracticeLogsByUserId(userId);
    const todayLogs = allLogs.filter(l => l.timestamp && toPacificDate(l.timestamp) === todayPT);
    const todayJogging = todayLogs.some(l => /jog|run/i.test(l.practice_name || ''));
    const todayLasso = todayLogs.some(l => /lasso|meditat/i.test(l.practice_name || ''));
    const timing = (todayJogging && todayLasso) ? 'post' : (todayJogging || todayLasso) ? 'partial' : 'pre';

    const responseId = `sr-${Date.now()}-${uniqueId(6)}`;
    await createSurveyResponse(responseId, {
      _userId: userId,
      surveyDefinitionId: SURVEY_ID,
      type: 'daily',
      _createdAt: now.toISOString(),
      scores,
      timing,
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
