//
// netlify/functions/_services/db-practices.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Practice Library) for Firestore.
// Single source of truth for practice definitions.
//
// Responsibilities:
//   - getPracticeByName(userId, name) - Find practice by name (case-insensitive)
//   - createPractice(id, data) - Create a new practice definition
//   - updatePractice(id, updates) - Update practice instructions/metadata
//   - incrementPracticeCheckins(practiceId) - Increment checkins counter
//   - getPracticesByUserId(userId) - Get all practices for a user
//
// Schema:
//   {
//     id: "practice-xyz",
//     name: "LASSO",  // Original casing preserved
//     instructions: "Latest/best version of instructions",
//     checkins: 12,  // Counter of how many times this practice was done
//     _userId: "u-xyz789",
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Find a practice by name (case-insensitive) for a specific user
 * @param {string} userId - User ID
 * @param {string} name - Practice name (case-insensitive)
 * @returns {Promise<Object|null>} Practice document or null if not found
 */
exports.getPracticeByName = async (userId, name) => {
  const results = await dbCore.query({
    collection: 'practices',
    where: `_userId::eq::${userId}`
  });

  // Case-insensitive match in JavaScript
  const practice = results.find(p =>
    p.name && p.name.toLowerCase() === name.toLowerCase()
  );

  return practice || null;
};

/**
 * Create a new practice
 * @param {string} id - Practice ID (with "practice-" prefix)
 * @param {Object} data - Practice data
 * @returns {Promise<Object>} Result with id
 */
exports.createPractice = async (id, data) => {
  const formattedId = id?.startsWith('practice-') ? id : `practice-${id}`;

  await dbCore.create(
    { collection: 'practices', id: formattedId, data }
  );

  return { id: formattedId };
};

/**
 * Update practice instructions and metadata
 * @param {string} id - Practice ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
exports.updatePractice = async (id, updates) => {
  await dbCore.update(
    { collection: 'practices', id, data: updates }
  );
};

/**
 * Increment practice checkins counter
 * @param {string} practiceId - Practice ID
 * @returns {Promise<void>}
 */
exports.incrementPracticeCheckins = async (practiceId) => {
  await dbCore.increment(
    { collection: 'practices', id: practiceId, field: 'checkins', value: 1 }
  );
};

/**
 * Get all practices for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of practice documents
 */
exports.getPracticesByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'practices',
    where: `_userId::eq::${userId}`
  });

  // Sort by checkins descending (most practiced first)
  return results.sort((a, b) => (b.checkins || 0) - (a.checkins || 0));
};

/**
 * Get total checkins count for a user (sum across all practices)
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Total checkins count
 */
exports.getTotalCheckins = async (userId) => {
  const practices = await exports.getPracticesByUserId(userId);
  return practices.reduce((total, practice) => total + (practice.checkins || 0), 0);
};
