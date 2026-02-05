require('dotenv').config();
const { createNote } = require('./_services/db-agent-notes.cjs');

/**
 * POST /api/agent-notes-create
 *
 * Create a new note for an agent.
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
    const { userId, agentId, type, title, content, metadata } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate agentId
    if (!agentId || typeof agentId !== 'string' || !agentId.startsWith('agent-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid agentId is required' })
      };
    }

    // Validate required fields
    if (!type || !title || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: type, title, and content are required'
        })
      };
    }

    // Create note
    const note = await createNote({
      _userId: userId,
      agentId,
      type,
      title,
      content,
      metadata: metadata || {}
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, note })
    };

  } catch (error) {
    console.error('Error in agent-notes-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
