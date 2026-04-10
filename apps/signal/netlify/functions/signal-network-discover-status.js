require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JOB_COLLECTION = 'signal-discover-jobs';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, jobId } = JSON.parse(event.body || '{}');
    if (!userId || !jobId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and jobId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found' }) };
    }

    const doc = await db.collection(JOB_COLLECTION).doc(jobId).get();
    if (!doc.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Job not found' }) };
    }

    const job = doc.data();
    if (job._ownerId !== owner.id) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        status: job.status,
        results: job.results || [],
        error: job.error || null,
      }),
    };

  } catch (error) {
    console.error('[signal-network-discover-status] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
