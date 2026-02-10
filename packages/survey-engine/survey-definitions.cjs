/**
 * Survey Definitions — CRUD for master survey templates.
 *
 * Collection: `survey-definitions`
 * Schema: { id, title, version, dimensions: [{ name, questions: [string] }] }
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'survey-definitions';

/**
 * Create or update a survey definition.
 */
async function createSurveyDefinition(id, data) {
  await dbCore.create({ collection: COLLECTION, id, data });
  return { id };
}

/**
 * Get a survey definition by ID.
 */
async function getSurveyDefinition(id) {
  return dbCore.get({ collection: COLLECTION, id });
}

module.exports = { createSurveyDefinition, getSurveyDefinition };
