require('dotenv').config();
const { getNoteById, deleteNote } = require('./_services/db-agent-notes.cjs');

/**
 * POST /api/agent-notes-delete
 *
 * Delete a note (hard delete).
 * See: docs/endpoints/agent-notes.md
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, noteId } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate noteId
    if (!noteId || typeof noteId !== 'string' || !noteId.startsWith('note-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid noteId is required' })
      };
    }

    // Check note exists and user owns it
    const note = await getNoteById(noteId);
    if (!note) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Note not found' })
      };
    }
    if (note._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Access denied' })
      };
    }

    // Delete note
    const result = await deleteNote(noteId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...result })
    };

  } catch (error) {
    console.error('Error in agent-notes-delete:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
