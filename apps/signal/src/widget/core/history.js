// core/history.js — chat persistence
// localStorage history deferred to TICKET-6-widget-chat-history
// This module handles server-side save only.

export async function saveChat(state, baseUrl) {
  if (!state.userId || !state.chatHistory.length) return;
  try {
    const mode = state.chatId ? 'append' : 'create';
    const body = { userId: state.userId, messages: state.chatHistory, mode };
    if (state.chatId) body.chatId = state.chatId;
    const res = await fetch(`${baseUrl}/api/signal-chat-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.chatId && !state.chatId) state.chatId = data.chatId;
  } catch (err) {
    console.warn('[signal/history] saveChat failed (non-fatal):', err);
  }
}
