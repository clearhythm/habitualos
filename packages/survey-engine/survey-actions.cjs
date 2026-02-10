/**
 * Survey Actions — lightweight action records for survey delivery.
 *
 * Collection: `survey-actions`
 * Schema: {
 *   id: "sa-{timestamp}{random}",
 *   surveyDefinitionId, type: "weekly"|"full",
 *   state: "open"|"completed",
 *   focusDimensions: [string],
 *   completedBy: [userId],
 *   createdAt, completedAt
 * }
 */

const dbCore = require('@habitualos/db-core');
const { FieldValue } = require('@habitualos/db-core');
const { uniqueId } = require('@habitualos/db-core');

const COLLECTION = 'survey-actions';

/**
 * Create a new survey action.
 */
async function createSurveyAction(data) {
  const id = `sa-${Date.now()}-${uniqueId(6)}`;
  await dbCore.create({
    collection: COLLECTION,
    id,
    data: {
      ...data,
      state: 'open',
      completedBy: [],
      createdAt: new Date().toISOString(),
      completedAt: null
    }
  });
  return { id };
}

/**
 * Get the current open survey action for a survey definition (if any).
 * Returns null if no open action exists.
 */
async function getOpenSurveyAction(surveyDefinitionId) {
  const results = await dbCore.query({
    collection: COLLECTION,
    where: `surveyDefinitionId::eq::${surveyDefinitionId}`
  });

  return results.find(a => a.state === 'open') || null;
}

/**
 * Mark a user as having completed a survey action.
 * If all expected users have completed, marks the action as fully completed.
 *
 * @param {string} actionId - Survey action ID
 * @param {string} userId - User who completed
 * @param {number} expectedUsers - Total number of users expected to complete (default 2)
 */
async function markUserCompleted(actionId, userId, expectedUsers = 2) {
  const action = await dbCore.get({ collection: COLLECTION, id: actionId });
  if (!action || action.state !== 'open') return null;

  const completedBy = action.completedBy || [];
  if (completedBy.includes(userId)) return action; // Already marked

  completedBy.push(userId);

  const updates = { completedBy };
  if (completedBy.length >= expectedUsers) {
    updates.state = 'completed';
    updates.completedAt = new Date().toISOString();
  }

  await dbCore.patch({ collection: COLLECTION, id: actionId, data: updates });
  return { ...action, ...updates };
}

/**
 * Check if a user has already completed a specific survey action.
 */
async function hasUserCompleted(actionId, userId) {
  const action = await dbCore.get({ collection: COLLECTION, id: actionId });
  if (!action) return false;
  return (action.completedBy || []).includes(userId);
}

module.exports = {
  createSurveyAction,
  getOpenSurveyAction,
  markUserCompleted,
  hasUserCompleted
};
