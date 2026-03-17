require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

/**
 * POST /api/signal-lead-save
 *
 * Saves a visitor lead after a high-score Signal conversation.
 * Called client-side when confidence ≥ 0.65 and nextStep is "schedule" or "connect".
 *
 * Body: {
 *   signalId: string,
 *   visitorId: string,        // window.__userId
 *   name: string,
 *   email: string,
 *   score: number,
 *   persona: string,
 *   nextStep: string,
 *   nextStepLabel: string,
 *   reason: string,           // from FIT_SCORE_UPDATE
 *   scores: { skills, alignment, personality, overall, confidence }
 * }
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
    const {
      signalId, visitorId, name, email,
      score, persona, nextStep, nextStepLabel, reason, scores
    } = JSON.parse(event.body);

    if (!signalId || !visitorId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'signalId and visitorId required' }) };
    }

    const docId = `${signalId}-${visitorId}`;
    await db.collection('signal-leads').doc(docId).set({
      signalId,
      visitorId,
      name: String(name || '').slice(0, 100),
      email: String(email || '').slice(0, 200),
      score: Number(score) || 0,
      persona: String(persona || ''),
      nextStep: String(nextStep || ''),
      nextStepLabel: String(nextStepLabel || ''),
      reason: String(reason || '').slice(0, 500),
      scores: scores || {},
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // merge: true so re-submitting updates instead of duplicating

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('[signal-lead-save] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
