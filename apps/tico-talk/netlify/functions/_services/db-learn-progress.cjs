//
// netlify/functions/_services/db-learn-progress.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Progress) for Firestore.
// Tracks which menu/drink sections a user has been judged to have
// learned during /learn/ drilling.
//
// Schema:
//   learn-progress/{userId}
//   {
//     "margaritaville": { "Starters": true, "Soup & Salad": true, ... },
//     "petes": { ... },
//     _updatedAt: Firestore timestamp (set automatically by db-core)
//   }
// Nested by restaurant so two restaurants sharing a section name (e.g.
// "Tacos") never mark each other learned.
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'learn-progress';

/**
 * Get a user's full learn-progress doc.
 * @param {string} userId
 * @returns {Promise<Object|null>} the doc, or null if the user has no progress yet
 */
exports.getLearnProgress = async (userId) => {
  return dbCore.get({ collection: COLLECTION, id: userId });
};

/**
 * Mark one section as learned for a user, at a given restaurant. Upserts
 * — safe to call whether or not the user has an existing doc yet
 * (dbCore.create merges if the doc already exists, per its own
 * docstring). A plain `{merge: true}` object write only shallow-merges
 * the top-level restaurantId key, so this reads the existing nested map
 * first to avoid clobbering that restaurant's other learned sections.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 * @returns {Promise<Object>} { id }
 */
exports.markSectionLearned = async (userId, restaurantId, sectionName) => {
  const existing = await dbCore.get({ collection: COLLECTION, id: userId });
  const restaurantProgress = (existing && existing[restaurantId]) || {};
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [restaurantId]: { ...restaurantProgress, [sectionName]: true } }
  });
};
