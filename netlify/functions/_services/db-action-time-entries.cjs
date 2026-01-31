//
// netlify/functions/_services/db-action-time-entries.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Action Time Entries) for Firestore.
// Manages time tracking entries for actions.
//
// Responsibilities:
//   - createTimeEntry(id, data) - Create a new time entry
//   - getTimeEntriesByAction(actionId, userId) - Get all entries for an action
//   - getTimeEntry(entryId) - Get single entry
//   - deleteTimeEntry(entryId) - Delete an entry
//   - getTotalTimeForAction(actionId, userId) - Sum of all durations
//
// Schema:
//   {
//     id: "ate-{uuid}",
//     _userId: "u-xyz789",
//     actionId: "action-abc123",
//     duration: 30,              // Minutes (integer)
//     note: "Worked on X...",    // Optional
//     loggedAt: "2024-01-15T10:00:00.000Z",  // When work was done
//     _createdAt: Firestore.Timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'work-action-time-entries';

/**
 * Generate a time entry ID
 * @returns {string} Time entry ID with "ate-" prefix
 */
function generateTimeEntryId() {
  return `ate-${uuidv4()}`;
}

/**
 * Create a new time entry
 * @param {string} id - Time entry ID (or null to auto-generate)
 * @param {Object} data - Entry data { _userId, actionId, duration, note?, loggedAt? }
 * @returns {Promise<Object>} Result with id
 */
exports.createTimeEntry = async (id, data) => {
  const entryId = id || generateTimeEntryId();

  await dbCore.create({
    collection: COLLECTION,
    id: entryId,
    data: {
      _userId: data._userId,
      actionId: data.actionId,
      duration: data.duration,
      note: data.note || null,
      loggedAt: data.loggedAt || new Date().toISOString()
    }
  });

  return { id: entryId };
};

/**
 * Get all time entries for an action
 * @param {string} actionId - Parent action ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of time entry documents
 */
exports.getTimeEntriesByAction = async (actionId, userId) => {
  const entries = await dbCore.query({
    collection: COLLECTION,
    where: `_userId::eq::${userId}`
  });

  // Filter by actionId (Firestore can't do compound where with this simple syntax)
  return entries.filter(e => e.actionId === actionId);
};

/**
 * Get a single time entry by ID
 * @param {string} entryId - Time entry ID
 * @returns {Promise<Object|null>} Time entry document or null
 */
exports.getTimeEntry = async (entryId) => {
  return await dbCore.get({ collection: COLLECTION, id: entryId });
};

/**
 * Delete a time entry
 * @param {string} entryId - Time entry ID
 * @returns {Promise<Object>} Result with id
 */
exports.deleteTimeEntry = async (entryId) => {
  return await dbCore.remove({ collection: COLLECTION, id: entryId });
};

/**
 * Get total time for an action (sum of all entry durations)
 * @param {string} actionId - Parent action ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<number>} Total minutes
 */
exports.getTotalTimeForAction = async (actionId, userId) => {
  const entries = await exports.getTimeEntriesByAction(actionId, userId);
  return entries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
};
