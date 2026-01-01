//
// netlify/functions/_services/db-practices.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Practices) for Firestore.
// Single source of truth for practice document operations.
//
// Responsibilities:
//   - getPracticesByUserId(userId) - Get all practices for a user
//   - createPractice(id, data) - Create a new practice
//
// Schema:
//   {
//     id: "p-abc123",
//     _userId: "u-xyz789",
//     timestamp: ISO string,
//     duration: number (minutes),
//     practice_name: string,
//     reflection: string,
//     obi_wan_message: string (optional),
//     obi_wan_feedback: "thumbs_up" | "thumbs_down" (optional),
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp (optional)
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Get all practices for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of practice documents
 */
exports.getPracticesByUserId = async (userId) => {
  // Query without orderBy to avoid index requirement initially
  // We'll sort client-side until the Firestore index is created
  const results = await dbCore.query({
    collection: 'practices',
    where: `_userId::eq::${userId}`
    // TODO: Add back once index is created: orderBy: 'timestamp::desc'
  });

  // Sort by timestamp descending (newest first) in JavaScript
  return results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
};

/**
 * Create a new practice
 * @param {string} id - Practice ID (with "p-" prefix)
 * @param {Object} data - Practice data
 * @returns {Promise<Object>} Result with id
 */
exports.createPractice = async (id, data) => {
  const formattedId = id?.startsWith('p-') ? id : `p-${id}`;

  await dbCore.create(
    { collection: 'practices', id: formattedId, data }
  );

  return { id: formattedId };
};

/**
 * Get practice count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of practices
 */
exports.getPracticeCount = async (userId) => {
  const practices = await exports.getPracticesByUserId(userId);
  return practices.length;
};
