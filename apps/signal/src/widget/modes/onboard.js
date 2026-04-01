// modes/onboard.js — onboard mode: scores the visitor for Signal readiness

import { getVisitorId } from '../core/storage.js';

export async function init(state, els, baseUrl) {
  state.userId = getVisitorId();

  els.personaWrap.hidden = false;
  els.personaPrompt.textContent = 'Loading…';
  els.personaBtns.innerHTML = '';

  try {
    const res = await fetch(`${baseUrl}/api/signal-onboard-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success) throw new Error('Init failed');

    els.personaWrap.hidden = true;

    const { appendMessage } = await import('../core/messages.js');
    appendMessage(els, 'assistant', data.opener);
    state.chatHistory.push({ role: 'assistant', content: data.opener });

    els.input.disabled = false;
    els.sendBtn.disabled = false;
    els.input.focus();
  } catch (err) {
    els.personaPrompt.textContent = 'Could not start. Please refresh and try again.';
    console.error('[signal/onboard] Init error:', err);
  }
}

export function buildPayload(state, text) {
  return {
    userId: state.userId,
    chatType: 'signal-onboard',
    message: text,
    chatHistory: state.chatHistory.slice(0, -1),
  };
}
