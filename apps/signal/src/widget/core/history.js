// core/history.js — chat persistence
// Strategy:
//   - localStorage: written every turn (instant, free)
//   - DB: written every 3 turns + on close (always full overwrite, no append)
//   - sendBeacon: best-effort on page unload

const LS_PREFIX = 'signal_chat_';

function lsKey(state) {
  return `${LS_PREFIX}${state.userId}_${state.signalId}`;
}

export function saveChatLS(state) {
  if (!state.userId || !state.chatHistory.length) return;
  try {
    localStorage.setItem(lsKey(state), JSON.stringify({
      chatId: state.chatId || null,
      messages: state.chatHistory,
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

export function clearChatLS(state) {
  try { localStorage.removeItem(lsKey(state)); } catch (_) {}
}

export async function persistChat(state, baseUrl) {
  if (!state.userId || !state.chatHistory.length) return;
  try {
    const body = JSON.stringify({
      userId: state.userId,
      signalId: state.signalId,
      chatId: state.chatId || null,
      messages: state.chatHistory,
    });
    const res = await fetch(`${baseUrl}/api/signal-chat-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    if (data.chatId) state.chatId = data.chatId;
  } catch (err) {
    console.warn('[signal/history] persistChat failed (non-fatal):', err);
  }
}

export function beaconChat(state, baseUrl) {
  if (!state.userId || !state.chatHistory.length) return;
  try {
    const body = JSON.stringify({
      userId: state.userId,
      signalId: state.signalId,
      chatId: state.chatId || null,
      messages: state.chatHistory,
    });
    navigator.sendBeacon(`${baseUrl}/api/signal-chat-save`, new Blob([body], { type: 'application/json' }));
  } catch (_) {}
}
