require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');

/**
 * POST /api/signal-evaluations-get
 *
 * Returns the owner's evaluation history, sorted by date desc.
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

    const snap = await db.collection('signal-evaluations')
      .where('signalId', '==', owner.id)
      .get();

    const evaluations = snap.docs
      .map(d => {
        const data = d.data();
        return {
          evalId: data.evalId,
          title: data.opportunity?.title || 'Untitled',
          type: data.opportunity?.type || 'free-text',
          score: data.score || {},
          recommendation: data.recommendation || '',
          summary: data.summary || '',
          resumeGenerated: data.resumeGenerated || false,
          coverLetterGenerated: data.coverLetterGenerated || false,
          mode: data.mode || '',
          reasoning: data.reasoning || null,
          strengths: data.strengths || [],
          gaps: data.gaps || [],
          jdSummary: data.jdSummary || null,
          _createdAt: data._createdAt
        };
      })
      .sort((a, b) => {
        const aTime = a._createdAt?._seconds || 0;
        const bTime = b._createdAt?._seconds || 0;
        return bTime - aTime;
      })
      .slice(0, 20);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, evaluations })
    };

  } catch (error) {
    console.error('[signal-evaluations-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
