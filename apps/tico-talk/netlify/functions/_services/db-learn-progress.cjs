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
//     "Starters": true,
//     "Soup & Salad": true,
//     ...
//     _updatedAt: Firestore timestamp (set automatically by db-core)
//   }
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
 * Mark one section as learned for a user. Upserts — safe to call whether
 * or not the user has an existing doc yet (dbCore.create merges if the
 * doc already exists, per its own docstring).
 * @param {string} userId
 * @param {string} sectionName
 * @returns {Promise<Object>} { id }
 */
exports.markSectionLearned = async (userId, sectionName) => {
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [sectionName]: true }
  });
};
