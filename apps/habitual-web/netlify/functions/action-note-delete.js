require('dotenv').config();
const { getNote, deleteNote } = require('./_services/db-action-notes.cjs');

/**
 * POST /api/action-note-delete
 *
 * Delete a note.
 * See: docs/endpoints/action-note-delete.md
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

    // Validate required fields
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!noteId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'noteId is required' })
      };
    }

    // Get note and verify ownership
    const note = await getNote(noteId);

    if (!note) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Note not found' })
      };
    }

    if (note._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Delete the note
    await deleteNote(noteId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error in action-note-delete:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
