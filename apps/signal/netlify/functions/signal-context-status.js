require('dotenv').config();
const { getOwnerByUserId, getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');

/**
 * POST /api/signal-context-status
 *
 * Returns chunk counts and profile completeness for a signalId.
 * Body: { userId } OR { signalId }
 * Returns: { success, stats, profiles }
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, signalId: paramSignalId } = JSON.parse(event.body);

    let owner;
    if (userId) {
      owner = await getOwnerByUserId(userId);
    } else if (paramSignalId) {
      owner = await getOwnerBySignalId(paramSignalId);
    } else {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'userId or signalId required' }) };
    }

    if (!owner) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Signal not found' }) };
    }

    const cs = owner.contextStats || {};
    const stats = {
      total: cs.totalChunks || 0,
      processed: cs.processedChunks || 0,
      pending: 0,
      bySource: cs.bySource || {}
    };

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        stats,
        lastUploadAt: [cs.lastUploadAt, cs.lastIngestAt].filter(Boolean).sort().pop() || null,
        skillsProfile: owner.skillsProfile || null,
        wantsProfile: owner.wantsProfile || null,
        personalityProfile: owner.personalityProfile || null,
        synthesizedContext: owner.synthesizedContext || null,
        synthesizedContextGeneratedAt: owner.synthesizedContextGeneratedAt || null,
        processedChunks: cs.processedChunks || 0
      })
    };

  } catch (error) {
    console.error('[signal-context-status] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
