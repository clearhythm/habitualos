require('dotenv').config();
const { getNote, updateNote } = require('./_services/db-action-notes.cjs');

/**
 * POST /api/action-note-update
 *
 * Update an existing note's content.
 * See: docs/endpoints/action-note-update.md
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, noteId, content } = JSON.parse(event.body);

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

    if (!content || typeof content !== 'string' || !content.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'content is required' })
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

    // Update the note
    await updateNote(noteId, { content: content.trim() });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error in action-note-update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
