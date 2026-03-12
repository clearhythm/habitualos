require('dotenv').config();
const { getOwnerByUserId, updateOwner } = require('./_services/db-signal-owners.cjs');
const { deleteAllChunks } = require('./_services/db-signal-context.cjs');

/**
 * POST /api/signal-context-delete
 *
 * Deletes all context chunks for the owner's signalId.
 * Also resets the owner's synthesized profiles and contextStats.
 *
 * Body: { userId }
 * Returns: { success, deleted }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or not active' }) };
    }

    const deleted = await deleteAllChunks(owner.signalId);

    // Reset synthesized profiles and stats
    await updateOwner(owner.signalId, {
      skillsProfile: null,
      wantsProfile: null,
      personalityProfile: null,
      contextStats: {
        totalChunks: 0,
        processedChunks: 0,
        bySource: { claude: 0, chatgpt: 0 },
        lastUploadAt: null,
        conceptGraph: {}
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, deleted })
    };

  } catch (error) {
    console.error('[signal-context-delete] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
