require('dotenv').config();
const { getAction } = require('./_services/db-actions.cjs');
const { createNote } = require('./_services/db-action-notes.cjs');

/**
 * POST /api/action-note-create
 *
 * Create a new note on an action.
 * See: docs/endpoints/action-note-create.md
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, actionId, content } = JSON.parse(event.body);

    // Validate required fields
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'actionId is required' })
      };
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'content is required' })
      };
    }

    // Verify action exists and belongs to user
    const action = await getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Action not found' })
      };
    }

    if (action._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Create the note
    const result = await createNote(null, {
      _userId: userId,
      actionId,
      content: content.trim()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        note: {
          id: result.id,
          actionId,
          content: content.trim()
        }
      })
    };

  } catch (error) {
    console.error('Error in action-note-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
