/**
 * Survey Focus — manages the precomputed focus dimensions.
 *
 * Collection: `survey-focus`
 * Keyed by surveyDefinitionId. Single document per survey.
 */

const dbCore = require('@habitualos/db-core');
const { getLatestFullResponses } = require('./survey-responses.cjs');
const { computeFocusDimensions } = require('./focus-algorithm.cjs');

const COLLECTION = 'survey-focus';

/**
 * Get the current focus dimensions for a survey.
 */
async function getFocus(surveyDefinitionId) {
  return dbCore.get({ collection: COLLECTION, id: surveyDefinitionId });
}

/**
 * Recalculate focus dimensions from the latest full-survey responses.
 * Called after a full survey is completed or during seeding.
 */
async function recalculateFocus(surveyDefinitionId) {
  const latestByUser = await getLatestFullResponses(surveyDefinitionId);

  // Build userScores map: userId → { dimension: average }
  const userScores = {};
  for (const [userId, response] of Object.entries(latestByUser)) {
    userScores[userId] = {};
    for (const score of response.scores) {
      userScores[userId][score.dimension] = score.average;
    }
  }

  const { focusDimensions, combinedScores } = computeFocusDimensions(userScores);

  await dbCore.create({
    collection: COLLECTION,
    id: surveyDefinitionId,
    data: {
      surveyDefinitionId,
      focusDimensions,
      combinedScores,
      lastCalculatedAt: new Date().toISOString()
    }
  });

  return { focusDimensions, combinedScores };
}

module.exports = { getFocus, recalculateFocus };
