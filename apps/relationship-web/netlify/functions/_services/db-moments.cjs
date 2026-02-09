/**
 * db-moments.cjs - Relationship Moments Service
 *
 * A "moment" is a meaningful interaction with someone in your life.
 * Examples: a conversation, receiving/giving a gift, a milestone, a memory.
 *
 * Collection: moments
 * Ownership: _userId (same pattern as HabitualOS)
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'moment-logs';

/**
 * Generate a unique moment ID
 * Format: moment-{timestamp36}{random4}
 */
function generateMomentId() {
  return dbCore.uniqueId('moment');
}

/**
 * Create a new moment
 *
 * @param {Object} params
 * @param {string} params.userId - Owner's user ID (required)
 * @param {string} params.addedBy - Name of the person who added this moment
 * @param {string} params.type - Emotional tone: 'happy', 'sad', 'hard'
 * @param {string} params.content - Description of the moment
 * @param {string} params.occurredAt - When it happened (ISO string, defaults to now)
 * @returns {Promise<{id: string}>}
 */
async function createMoment({ userId, addedBy, type, content, occurredAt, chatId }) {
  const id = generateMomentId();

  await dbCore.create({
    collection: COLLECTION,
    id,
    data: {
      _userId: userId,
      addedBy: addedBy || null,
      type: type || 'happy',
      content: content || '',
      occurredAt: occurredAt || new Date().toISOString(),
      chatId: chatId || null
    }
  });

  return { id };
}

/**
 * Get all moments for a user
 *
 * @param {string} userId
 * @returns {Promise<Array>} Moments sorted by occurredAt desc
 */
async function getMomentsByUserId(userId) {
  return dbCore.query({
    collection: COLLECTION,
    where: `_userId::eq::${userId}`,
    orderBy: 'occurredAt::desc'
  });
}

/**
 * Get a single moment by ID
 *
 * @param {string} id - Moment ID
 * @returns {Promise<Object|null>}
 */
async function getMoment(id) {
  return dbCore.get({ collection: COLLECTION, id });
}

/**
 * Update a moment
 *
 * @param {string} id - Moment ID
 * @param {Object} data - Fields to update
 * @returns {Promise<{id: string}>}
 */
async function updateMoment(id, data) {
  return dbCore.patch({ collection: COLLECTION, id, data });
}

/**
 * Delete a moment
 *
 * @param {string} id - Moment ID
 * @returns {Promise<{id: string}>}
 */
async function deleteMoment(id) {
  return dbCore.remove({ collection: COLLECTION, id });
}

/**
 * Get all moments across all users
 *
 * @returns {Promise<Array>} Moments sorted by occurredAt desc
 */
async function getAllMoments() {
  return dbCore.query({
    collection: COLLECTION,
    orderBy: 'occurredAt::desc'
  });
}

module.exports = {
  generateMomentId,
  createMoment,
  getMomentsByUserId,
  getAllMoments,
  getMoment,
  updateMoment,
  deleteMoment
};
