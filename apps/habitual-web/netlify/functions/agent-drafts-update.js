require('dotenv').config();
const { getDraftById, updateDraft } = require('./_services/db-agent-drafts.cjs');

/**
 * POST /api/agent-drafts-update
 *
 * Update an existing draft's status or data.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, draftId, status, data } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate draftId
    if (!draftId || typeof draftId !== 'string' || !draftId.startsWith('draft-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid draftId is required' })
      };
    }

    // Build updates from provided fields
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (data !== undefined) updates.data = data;

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'At least one of status or data is required' })
      };
    }

    // Check draft exists and user owns it
    const draft = await getDraftById(draftId);
    if (!draft) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Draft not found' })
      };
    }
    if (draft._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Access denied' })
      };
    }

    // Update draft
    const result = await updateDraft(draftId, updates);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result })
    };

  } catch (error) {
    console.error('Error in agent-drafts-update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
