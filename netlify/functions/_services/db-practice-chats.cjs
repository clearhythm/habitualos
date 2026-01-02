//
// netlify/functions/_services/db-practice-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Practice Chats) for Firestore.
// Single source of truth for practice chat operations.
//
// Responsibilities:
//   - getPracticeChatsByUserId(userId) - Get all practice chats for a user
//   - createPracticeChat(id, data) - Create a new practice chat
//
// Schema:
//   {
//     id: "pc-abc123",
//     _userId: "u-xyz789",
//     messages: [
//       { role: "assistant", content: "...", timestamp: "..." },
//       { role: "user", content: "...", timestamp: "..." }
//     ],
//     suggestedPractice: string (optional),
//     completed: boolean (true if resulted in practice),
//     savedAt: ISO string,
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp (optional)
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Get all practice chats for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of practice chat documents
 */
exports.getPracticeChatsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'practice-chats',
    where: `_userId::eq::${userId}`
  });

  // Sort by savedAt descending (newest first) in JavaScript
  return results.sort((a, b) => {
    const timeA = new Date(a.savedAt).getTime();
    const timeB = new Date(b.savedAt).getTime();
    return timeB - timeA;
  });
};

/**
 * Create a new practice chat
 * @param {string} id - Practice chat ID (with "pc-" prefix)
 * @param {Object} data - Practice chat data
 * @returns {Promise<Object>} Result with id
 */
exports.createPracticeChat = async (id, data) => {
  const formattedId = id?.startsWith('pc-') ? id : `pc-${id}`;

  await dbCore.create(
    { collection: 'practice-chats', id: formattedId, data }
  );

  return { id: formattedId };
};

/**
 * Get practice chat count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of practice chats
 */
exports.getPracticeChatCount = async (userId) => {
  const chats = await exports.getPracticeChatsByUserId(userId);
  return chats.length;
};
