/**
 * Survey Responses — CRUD for individual user survey responses.
 *
 * Collection: `survey-responses`
 * Schema: {
 *   id: "sr-{timestamp}{random}",
 *   _userId, surveyDefinitionId, type: "full"|"weekly",
 *   timestamp (ISO), scores: [{ dimension, questionScores?, average }],
 *   surveyActionId?
 * }
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'survey-responses';

/**
 * Create a survey response.
 */
async function createSurveyResponse(id, data) {
  const formattedId = id?.startsWith('sr-') ? id : `sr-${id}`;
  await dbCore.create({ collection: COLLECTION, id: formattedId, data });
  return { id: formattedId };
}

/**
 * Get all responses for a survey definition (across all users).
 * Used by focus algorithm to compute combined scores.
 */
async function getResponsesBySurvey(surveyDefinitionId, { type } = {}) {
  const results = await dbCore.query({
    collection: COLLECTION,
    where: `surveyDefinitionId::eq::${surveyDefinitionId}`
  });

  let filtered = results;
  if (type) {
    filtered = results.filter(r => r.type === type);
  }

  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get responses for a specific user.
 */
async function getResponsesByUser(userId, surveyDefinitionId) {
  const results = await dbCore.query({
    collection: COLLECTION,
    where: `_userId::eq::${userId}`
  });

  return results
    .filter(r => r.surveyDefinitionId === surveyDefinitionId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get the most recent full-survey response per user for a survey definition.
 * Returns a map of userId → response.
 */
async function getLatestFullResponses(surveyDefinitionId) {
  const all = await getResponsesBySurvey(surveyDefinitionId, { type: 'full' });

  const latestByUser = {};
  for (const response of all) {
    if (!latestByUser[response._userId]) {
      latestByUser[response._userId] = response;
    }
  }
  return latestByUser;
}

module.exports = {
  createSurveyResponse,
  getResponsesBySurvey,
  getResponsesByUser,
  getLatestFullResponses
};
