// core/score.js — score delivery via chat (panel removed)
// Score panel UI deferred to TICKET-5-widget-nextstep

export function resetScorePanel(els) {
  // no-op: score panel removed from DOM
}

export function updateScore(els, state, data) {
  state.lastScore = data;
  // Score panel removed — score delivered inline in chat via evaluate_fit tool
}

export function switchTab(els, name) {
  // no-op: tabs removed
}

// TODO: TICKET-5-widget-nextstep — wire up next-step CTA in chat area
export function renderNextStep(els, state, step, label) {
  // stub
}
