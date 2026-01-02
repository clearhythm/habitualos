//
// netlify/functions/_services/db-practice-logs.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Practice Logs) for Firestore.
// Handles individual practice log entries.
//
// Responsibilities:
//   - getPracticeLogsByUserId(userId) - Get all practice logs for a user
//   - createPracticeLog(id, data) - Create a new practice log entry
//   - getPracticeLogCount(userId) - Get total count of practice logs
//
// Schema:
//   {
//     id: "p-abc123",
//     _userId: "u-xyz789",
//     practice_name: "LASSO",
//     duration: 15,  // minutes (optional)
//     reflection: "...",  // user's reflection (optional)
//     obi_wan_message: "...",  // short wisdom (optional)
//     obi_wan_expanded: "...",  // long wisdom (optional)
//     timestamp: ISO string,
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Get all practice logs for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of practice log documents
 */
exports.getPracticeLogsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'practice-logs',
    where: `_userId::eq::${userId}`
  });

  // Sort by timestamp descending (newest first) in JavaScript
  return results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
};

/**
 * Create a new practice log
 * @param {string} id - Practice log ID (with "p-" prefix)
 * @param {Object} data - Practice log data
 * @returns {Promise<Object>} Result with id
 */
exports.createPracticeLog = async (id, data) => {
  const formattedId = id?.startsWith('p-') ? id : `p-${id}`;

  await dbCore.create(
    { collection: 'practice-logs', id: formattedId, data }
  );

  return { id: formattedId };
};

/**
 * Get practice log count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of practice logs
 */
exports.getPracticeLogCount = async (userId) => {
  const logs = await exports.getPracticeLogsByUserId(userId);
  return logs.length;
};
