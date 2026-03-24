'use strict';
const { db, admin } = require('@habitualos/db-core');

function computeOverall(skills, alignment, personality) {
  if (personality != null) {
    return Math.round(skills * 0.50 + alignment * 0.35 + personality * 0.15);
  }
  return Math.round(skills * 0.55 + alignment * 0.45);
}

/**
 * Create a new evaluation record in signal-evaluations.
 * Returns { evalId }.
 */
async function createEvaluation({ signalId, userId, mode, roleTitle, summary, score, strengths, gaps, recommendation } = {}) {
  const evalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const s = score?.skills != null ? Number(score.skills) : null;
  const a = score?.alignment != null ? Number(score.alignment) : null;
  const p = score?.personality != null ? Number(score.personality) : null;

  await db.collection('signal-evaluations').doc(evalId).set({
    evalId,
    signalId,
    userId: userId || null,
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
      confidence: score?.confidence != null ? Number(score.confidence) : null,
    },
    summary: summary || '',
    strengths: strengths || [],
    gaps: gaps || [],
    recommendation: recommendation || '',
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { evalId };
}

/**
 * Upsert an existing evaluation record — replaces score, summary, strengths, gaps, recommendation.
 */
async function upsertEvaluation(evalId, { score, summary, strengths, gaps, recommendation } = {}) {
  const patch = { _updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (score) {
    const s = score.skills != null ? Number(score.skills) : undefined;
    const a = score.alignment != null ? Number(score.alignment) : undefined;
    const p = score.personality != null ? Number(score.personality) : null;
    if (s != null) patch['score.skills'] = s;
    if (a != null) patch['score.alignment'] = a;
    patch['score.personality'] = p;
    if (score.confidence != null) patch['score.confidence'] = Number(score.confidence);
    if (s != null && a != null) patch['score.overall'] = computeOverall(s, a, p);
  }
  if (summary != null) patch.summary = summary;
  if (strengths != null) patch.strengths = strengths;
  if (gaps != null) patch.gaps = gaps;
  if (recommendation != null) patch.recommendation = recommendation;

  await db.collection('signal-evaluations').doc(evalId).update(patch);
}

module.exports = { createEvaluation, upsertEvaluation };
