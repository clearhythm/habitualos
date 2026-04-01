// modes/owner.js — owner mode: diagnostic chat for the Signal profile owner

import { getOwnerSession, setOwnerSession, clearOwnerSession } from '../core/storage.js';
import { appendMessage } from '../core/messages.js';

export async function init(state, els, baseUrl) {
  // Use existing session if valid
  const session = getOwnerSession(state.signalId);
  if (session) {
    state.userId = session.userId;
    state.ownerSession = session;
  }

  els.personaWrap.hidden = true;

  try {
    const res = await fetch(`${baseUrl}/api/signal-owner-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: state.signalId,
        ...(state.evalContext ? { evalContext: state.evalContext } : {}),
      }),
    });
    const data = await res.json();

    if (els.title) {
      els.title.innerHTML = `Signal Interview <span class="owner-badge">owner</span>`;
    }

    if (data.opener) {
      state.chatHistory.push({ role: 'assistant', content: data.opener });
      appendMessage(els, 'assistant', data.opener);
    }

    els.input.disabled = false;
    els.sendBtn.disabled = false;
    els.input.focus();
  } catch (err) {
    appendMessage(els, 'assistant', 'Owner mode ready.');
    els.input.disabled = false;
    els.sendBtn.disabled = false;
    console.error('[signal/owner] Init error:', err);
  }
}

export function buildPayload(state, text) {
  return {
    userId: state.userId,
    chatType: 'signal-owner',
    signalId: state.signalId,
    message: text,
    chatHistory: state.chatHistory.slice(0, -1),
    ...(state.currentEvalId ? { currentEvalId: state.currentEvalId } : {}),
  };
}

/**
 * Handle /signin, /signout, and multi-step auth state.
 * Returns true if the command was consumed (caller should not send as chat message).
 */
export async function handleCommand(cmd, state, els, baseUrl) {
  // Multi-step auth: awaiting email
  if (state.authState === 'awaiting_email') {
    const email = cmd.trim();
    if (!email) return false;
    state.authEmail = email;
    appendMessage(els, 'assistant', `Sending a code to ${email}…`);
    try {
      const res = await fetch(`${baseUrl}/api/signal-auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, signalId: state.signalId }),
      });
      const data = await res.json();
      if (data.success) {
        state.authState = 'awaiting_code';
        appendMessage(els, 'assistant', 'Check your email for a 6-digit code, then enter it here.');
      } else {
        state.authState = null;
        state.authEmail = null;
        appendMessage(els, 'assistant', `Couldn't send code: ${data.error || 'unknown error'}. Try again with /signin.`);
      }
    } catch (err) {
      state.authState = null;
      state.authEmail = null;
      appendMessage(els, 'assistant', 'Something went wrong sending the code. Try /signin again.');
      console.error('[signal/owner] auth-login error:', err);
    }
    return true;
  }

  // Multi-step auth: awaiting code
  if (state.authState === 'awaiting_code') {
    const code = cmd.trim();
    if (!code) return false;
    try {
      const res = await fetch(`${baseUrl}/api/signal-auth-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.authEmail, code }),
      });
      const data = await res.json();
      if (data.success) {
        setOwnerSession(data.userId, data.signalId, data.displayName);
        state.userId = data.userId;
        state.ownerSession = { userId: data.userId, signalId: data.signalId, displayName: data.displayName };
        state.authState = null;
        state.authEmail = null;
        appendMessage(els, 'assistant', `Signed in as ${data.displayName}. You're now in owner mode.`);
      } else {
        appendMessage(els, 'assistant', `Invalid code: ${data.error || 'please try again'}.`);
      }
    } catch (err) {
      appendMessage(els, 'assistant', 'Verification failed. Try /signin again.');
      console.error('[signal/owner] auth-verify error:', err);
    }
    return true;
  }

  // /signin command
  if (cmd.trim().toLowerCase() === '/signin') {
    state.authState = 'awaiting_email';
    appendMessage(els, 'assistant', 'Enter the email address associated with your Signal account:');
    return true;
  }

  // /signout command
  if (cmd.trim().toLowerCase() === '/signout') {
    clearOwnerSession(state.signalId);
    state.ownerSession = null;
    state.userId = null;
    appendMessage(els, 'assistant', 'Signed out.');
    return true;
  }

  return false;
}
