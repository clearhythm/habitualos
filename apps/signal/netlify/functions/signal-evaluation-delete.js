require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { CORS, corsOptions, methodNotAllowed, serverError } = require('./_services/signal-init-shared.cjs');

/**
 * POST /api/signal-evaluation-delete
 * Body: { userId, evalId }
 * Verifies ownership before deleting.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsOptions();
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { userId, evalId } = JSON.parse(event.body || '{}');

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!evalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'evalId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found' }) };
    }

    const ref = db.collection('signal-evaluations').doc(evalId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().signalId !== owner.id) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Evaluation not found' }) };
    }

    await ref.delete();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    return serverError('signal-evaluation-delete', error);
  }
};
