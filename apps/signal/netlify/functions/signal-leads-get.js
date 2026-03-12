require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');

/**
 * POST /api/signal-leads-get
 *
 * Returns leads for the owner's signalId, sorted by score desc.
 * Body: { userId }
 * Returns: { success, leads }
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

    const snap = await db.collection('signal-leads')
      .where('signalId', '==', owner.signalId)
      .get();

    const leads = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // cap at 50

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, leads })
    };

  } catch (error) {
    console.error('[signal-leads-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
