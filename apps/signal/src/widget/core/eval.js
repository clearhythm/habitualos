// core/eval.js — evaluation record persistence (fire-and-forget)

export function createEvalRecord(state, opts = {}) {
  if (!state.signalId) return;
  const { roleTitle, summary, scores, strengths, gaps } = opts;
  fetch(`${state.baseUrl}/api/signal-evaluation-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalId: state.signalId,
      userId: state.userId,
      mode: state.activeMode,
      roleTitle: roleTitle || null,
      summary: summary || null,
      scores: scores || null,
      strengths: strengths || null,
      gaps: gaps || null,
    }),
  })
    .then((r) => r.json())
    .then((data) => { if (data.success) state.currentEvalId = data.evalId; })
    .catch((err) => console.warn('[signal/eval] createEvalRecord failed (non-fatal):', err));
}

export function upsertEvalScores(state, scores) {
  if (!state.currentEvalId || !state.signalId) return;
  fetch(`${state.baseUrl}/api/signal-evaluation-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evalId: state.currentEvalId, signalId: state.signalId, scores }),
  }).catch(() => {});
}
