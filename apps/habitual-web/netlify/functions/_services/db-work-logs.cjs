//
// netlify/functions/_services/db-work-logs.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Work Logs) for Firestore.
// Handles retrospective work log entries for the executive assistant system.
//
// Responsibilities:
//   - getWorkLogsByUserId(userId) - Get all work logs for a user
//   - getWorkLogsByProject(projectId, userId) - Get work logs for a project
//   - createWorkLog(id, data) - Create a new work log
//   - getWorkLogCount(userId) - Get total count of work logs
//
// Schema:
//   {
//     id: "w-1706550000000-abc123",
//     _userId: "u-xyz789",
//     projectId: "project-abc123",  // optional
//     actionId: "action-abc123",    // optional - if from action completion
//     agentId: "agent-abc123",      // optional - if agent completed
//     title: "Resume formatting",
//     duration: 45,  // minutes, optional
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

/**
 * Generate a work log ID
 * @returns {string} ID in format w-{timestamp}-{random}
 */
function generateWorkLogId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `w-${timestamp}-${random}`;
}

/**
 * Get all work logs for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of work log documents
 */
exports.getWorkLogsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'work-logs',
    where: `_userId::eq::${userId}`
  });

  // Sort by created date descending (newest first)
  return results.sort((a, b) => {
    const timeA = a._createdAt?.toMillis?.() || 0;
    const timeB = b._createdAt?.toMillis?.() || 0;
    return timeB - timeA;
  });
};

/**
 * Get work logs for a specific project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of work log documents
 */
exports.getWorkLogsByProject = async (projectId, userId) => {
  const allLogs = await exports.getWorkLogsByUserId(userId);
  return allLogs.filter(log => log.projectId === projectId);
};

/**
 * Create a new work log
 * @param {string} id - Work log ID (optional, will generate if not provided)
 * @param {Object} data - Work log data
 * @returns {Promise<Object>} Result with id and the created work log
 */
exports.createWorkLog = async (id, data) => {
  const formattedId = id || generateWorkLogId();

  await dbCore.create({
    collection: 'work-logs',
    id: formattedId,
    data
  });

  return { id: formattedId };
};

/**
 * Get work log count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of work logs
 */
exports.getWorkLogCount = async (userId) => {
  const logs = await exports.getWorkLogsByUserId(userId);
  return logs.length;
};
