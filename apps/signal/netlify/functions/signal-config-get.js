require('dotenv').config();
const { getOwnerBySignalId, getOwnerByUserId } = require('./_services/db-signal-owners.cjs');

/**
 * POST /api/signal-config-get
 *
 * Body: { signalId } OR { userId }
 *
 * Returns public-facing config (no API key).
 * Used by: widget page (signalId), dashboard (userId).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { signalId, userId } = JSON.parse(event.body);

    let owner;
    if (signalId) {
      owner = await getOwnerBySignalId(signalId);
    } else if (userId) {
      owner = await getOwnerByUserId(userId);
    } else {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'signalId or userId required' }) };
    }

    if (!owner) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Signal not found' }) };
    }

    // Never return the encrypted API key to the client
    const { anthropicApiKey: _omit, ...publicConfig } = owner;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, config: publicConfig })
    };

  } catch (error) {
    console.error('[signal-config-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
