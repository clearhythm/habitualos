//
// netlify/functions/_services/db-action-notes.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Action Notes) for Firestore.
// Manages user notes on actions.
//
// Responsibilities:
//   - createNote(id, data) - Create a new note
//   - getNotesByAction(actionId, userId) - Get all notes for an action
//   - getNote(noteId) - Get single note
//   - updateNote(noteId, updates) - Update note content
//   - deleteNote(noteId) - Delete a note
//
// Schema:
//   {
//     id: "an-{timestamp}-{random}",
//     _userId: "u-xyz789",
//     actionId: "action-abc123",
//     content: "Note text...",
//     _createdAt: Firestore.Timestamp,
//     _updatedAt: Firestore.Timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'work-action-notes';

/**
 * Generate a note ID
 * @returns {string} Note ID with "an-" prefix
 */
function generateNoteId() {
  return `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new note
 * @param {string} id - Note ID (or null to auto-generate)
 * @param {Object} data - Note data { _userId, actionId, content }
 * @returns {Promise<Object>} Result with id
 */
exports.createNote = async (id, data) => {
  const noteId = id || generateNoteId();

  await dbCore.create({
    collection: COLLECTION,
    id: noteId,
    data: {
      _userId: data._userId,
      actionId: data.actionId,
      content: data.content
    }
  });

  return { id: noteId };
};

/**
 * Get all notes for an action
 * @param {string} actionId - Parent action ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of note documents
 */
exports.getNotesByAction = async (actionId, userId) => {
  const notes = await dbCore.query({
    collection: COLLECTION,
    where: `_userId::eq::${userId}`
  });

  // Filter by actionId (Firestore can't do compound where with this simple syntax)
  return notes.filter(n => n.actionId === actionId);
};

/**
 * Get a single note by ID
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} Note document or null
 */
exports.getNote = async (noteId) => {
  return await dbCore.get({ collection: COLLECTION, id: noteId });
};

/**
 * Update note content
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update { content }
 * @returns {Promise<Object>} Result with id
 */
exports.updateNote = async (noteId, updates) => {
  return await dbCore.patch({
    collection: COLLECTION,
    id: noteId,
    data: { content: updates.content }
  });
};

/**
 * Delete a note
 * @param {string} noteId - Note ID
 * @returns {Promise<Object>} Result with id
 */
exports.deleteNote = async (noteId) => {
  return await dbCore.remove({ collection: COLLECTION, id: noteId });
};
