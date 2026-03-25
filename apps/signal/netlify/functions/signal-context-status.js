require('dotenv').config();
const { getOwnerByUserId, getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { getContextStats } = require('./_services/db-signal-context.cjs');

/**
 * POST /api/signal-context-status
 *
 * Returns chunk counts and profile completeness for a signalId.
 * Body: { userId } OR { signalId }
 * Returns: { success, stats, profiles }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
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

    const stats = await getContextStats(owner.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        stats,
        lastUploadAt: owner.contextStats?.lastUploadAt || null,
        skillsProfile: owner.skillsProfile || null,
        wantsProfile: owner.wantsProfile || null,
        personalityProfile: owner.personalityProfile || null
      })
    };

  } catch (error) {
    console.error('[signal-context-status] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
