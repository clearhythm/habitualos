require('dotenv').config();
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { getJobAlerts } = require('./_services/db-signal-job-alerts.cjs');

/**
 * POST /api/signal-job-alerts-get
 * Returns the owner's job alert history.
 * Body: { userId }
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
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const alerts = await getJobAlerts({ signalId: owner.id });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, alerts }),
    };

  } catch (error) {
    console.error('[signal-job-alerts-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
