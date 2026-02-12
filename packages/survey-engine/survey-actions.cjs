/**
 * Survey Actions — lightweight per-user action records for survey delivery.
 *
 * Collection: `survey-actions`
 * Schema: {
 *   id: "sa-{timestamp}{random}",
 *   _userId, surveyDefinitionId, type: "weekly"|"full",
 *   state: "open"|"completed",
 *   focusDimensions: [string],
 *   createdAt, completedAt
 * }
 */

const dbCore = require('@habitualos/db-core');
const { uniqueId } = require('@habitualos/db-core');

const COLLECTION = 'survey-actions';

/**
 * Create a new survey action for a specific user.
 */
async function createSurveyAction(data) {
  const id = `sa-${Date.now()}-${uniqueId(6)}`;
  await dbCore.create({
    collection: COLLECTION,
    id,
    data: {
      ...data,
      state: 'open',
      createdAt: new Date().toISOString(),
      completedAt: null
    }
  });
  return { id };
}

/**
 * Get the current open survey action for a user and survey definition.
 * Returns null if no open action exists.
 */
async function getOpenSurveyAction(surveyDefinitionId, userId) {
  const results = await dbCore.query({
    collection: COLLECTION,
    where: `surveyDefinitionId::eq::${surveyDefinitionId}`
  });

  return results.find(a => a.state === 'open' && a._userId === userId) || null;
}

/**
 * Mark a survey action as completed.
 */
async function markActionCompleted(actionId) {
  const action = await dbCore.get({ collection: COLLECTION, id: actionId });
  if (!action || action.state !== 'open') return null;

  const updates = {
    state: 'completed',
    completedAt: new Date().toISOString()
  };

  await dbCore.patch({ collection: COLLECTION, id: actionId, data: updates });
  return { ...action, ...updates };
}

module.exports = {
  createSurveyAction,
  getOpenSurveyAction,
  markActionCompleted
};
