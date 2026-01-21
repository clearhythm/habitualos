//
// netlify/functions/_services/db-agent-notes.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agent Notes) for Firestore.
// Handles quick-capture notes associated with agents.
//
// Responsibilities:
//   - createNote(data) - Create a new note
//   - getNoteById(noteId) - Get single note by ID
//   - getNotesByAgent(agentId, userId, filters?) - Get notes for an agent
//   - updateNote(noteId, updates) - Update note fields
//   - archiveNote(noteId) - Set status to archived
//   - deleteNote(noteId) - Hard delete
//
// Schema:
//   {
//     id: "note-abc123",
//     agentId: "agent-xyz",
//     _userId: "u-123",
//     type: string,         // freeform: "url", "idea", "bookmark", etc.
//     title: string,
//     content: string,
//     metadata: {           // optional
//       url?: string,
//       tags?: string[],
//       source?: string
//     },
//     status: "active" | "archived" | "merged",
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { generateAgentNoteId } = require('../_utils/data-utils.cjs');

/**
 * Create a new agent note
 * @param {Object} data - Note data (agentId, _userId, type, title, content, metadata?)
 * @returns {Promise<Object>} Created note with id
 */
exports.createNote = async (data) => {
  const id = generateAgentNoteId();

  const noteData = {
    ...data,
    status: data.status || 'active',
    metadata: data.metadata || {}
  };

  await dbCore.create({
    collection: 'agent-notes',
    id,
    data: noteData
  });

  return { id, ...noteData };
};

/**
 * Get a single note by ID
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} Note document or null
 */
exports.getNoteById = async (noteId) => {
  return await dbCore.get({
    collection: 'agent-notes',
    id: noteId
  });
};

/**
 * Get all notes for an agent (filtered by userId)
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID for ownership check
 * @param {Object} filters - Optional filters { status?, type?, limit? }
 * @returns {Promise<Array>} Array of notes (newest first)
 */
exports.getNotesByAgent = async (agentId, userId, filters = {}) => {
  // Build where clauses
  const whereClause = `agentId::eq::${agentId}`;

  let results = await dbCore.query({
    collection: 'agent-notes',
    where: whereClause
  });

  // Filter by userId (security)
  results = results.filter(note => note._userId === userId);

  // Apply optional filters
  if (filters.status) {
    results = results.filter(note => note.status === filters.status);
  }
  if (filters.type) {
    results = results.filter(note => note.type === filters.type);
  }

  // Sort by _createdAt descending (newest first)
  results.sort((a, b) => {
    const timeA = a._createdAt?._seconds || 0;
    const timeB = b._createdAt?._seconds || 0;
    return timeB - timeA;
  });

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    results = results.slice(0, filters.limit);
  }

  return results;
};

/**
 * Update a note's fields
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result
 */
exports.updateNote = async (noteId, updates) => {
  // Only allow updating specific fields
  const allowedFields = ['title', 'content', 'type', 'status', 'metadata'];
  const safeUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new Error('No valid updates provided');
  }

  await dbCore.patch({
    collection: 'agent-notes',
    id: noteId,
    data: safeUpdates
  });

  return { id: noteId, updated: Object.keys(safeUpdates) };
};

/**
 * Archive a note (soft delete)
 * @param {string} noteId - Note ID
 * @returns {Promise<Object>} Result
 */
exports.archiveNote = async (noteId) => {
  await dbCore.patch({
    collection: 'agent-notes',
    id: noteId,
    data: { status: 'archived' }
  });

  return { id: noteId, status: 'archived' };
};

/**
 * Delete a note (hard delete)
 * @param {string} noteId - Note ID
 * @returns {Promise<Object>} Result
 */
exports.deleteNote = async (noteId) => {
  await dbCore.remove({
    collection: 'agent-notes',
    id: noteId
  });

  return { id: noteId, deleted: true };
};
