require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { CORS, corsOptions, methodNotAllowed, serverError } = require('./_services/signal-init-shared.cjs');

/**
 * POST /api/signal-evaluation-save
 *
 * Create or upsert a signal-evaluation record from any source:
 * widget owner mode (JD or conversational), widget visitor mode, or dashboard form.
 *
 * Create (no evalId):
 *   { signalId, userId, mode, roleTitle?, summary?, scores? }
 *   → returns { success, evalId }
 *
 * Upsert scores (with evalId):
 *   { evalId, signalId, scores: { skills, alignment, personality, confidence } }
 *   → returns { success, evalId }
 */

function computeOverall(skills, alignment, personality) {
  if (personality != null) {
    return Math.round(skills * 0.50 + alignment * 0.35 + personality * 0.15);
  }
  return Math.round(skills * 0.55 + alignment * 0.45);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsOptions();
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { evalId, signalId, userId, mode, roleTitle, summary, scores, strengths, gaps } = JSON.parse(event.body || '{}');

    if (!signalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'signalId required' }) };
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();

    if (evalId) {
      // Upsert scores on existing record
      const patch = { _updatedAt: ts };
      if (scores) {
        const s = scores.skills != null ? Number(scores.skills) : undefined;
        const a = scores.alignment != null ? Number(scores.alignment) : undefined;
        const p = scores.personality != null ? Number(scores.personality) : null;
        if (s != null) patch['score.skills'] = s;
        if (a != null) patch['score.alignment'] = a;
        patch['score.personality'] = p;
        if (scores.confidence != null) patch['score.confidence'] = Number(scores.confidence);
        if (s != null && a != null) patch['score.overall'] = computeOverall(s, a, p);
      }
      await db.collection('signal-evaluations').doc(evalId).update(patch);
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, evalId }),
      };
    }

    // Create new record
    const newEvalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const s = scores?.skills != null ? Number(scores.skills) : null;
    const a = scores?.alignment != null ? Number(scores.alignment) : null;
    const p = scores?.personality != null ? Number(scores.personality) : null;

    await db.collection('signal-evaluations').doc(newEvalId).set({
      _evalId: newEvalId,
      _signalId: signalId,
      _userId: userId || null,
      mode: mode || 'widget',
      opportunity: {
        title: roleTitle || null,
        type: roleTitle ? 'jd' : 'conversational',
      },
      score: {
        skills: s,
        alignment: a,
        personality: p,
        overall: (s != null && a != null) ? computeOverall(s, a, p) : null,
        confidence: scores?.confidence != null ? Number(scores.confidence) : null,
      },
      summary: summary || '',
      strengths: strengths || [],
      gaps: gaps || [],
      _createdAt: ts,
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, evalId: newEvalId }),
    };

  } catch (error) {
    return serverError('signal-evaluation-save', error);
  }
};
