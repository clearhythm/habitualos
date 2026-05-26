import { post, get } from '../api.js';
import { generateReflectChatId } from '../utils/id.js';

const LS_HISTORY  = 'reflect-chat-history';
const LS_SAVED    = 'reflect-chat-saved';
const LS_CHAT_ID  = 'reflect-chat-id';

/**
 * saveReflectChat — fire-and-forget via sendBeacon.
 * Returns true if the browser accepted the request, false otherwise.
 * Use for pre-navigation saves (beginBtn, end_conversation).
 */
export function saveReflectChatBeacon({ chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration }) {
  const payload = JSON.stringify({ chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration });
  return navigator.sendBeacon('/api/reflect-chat-save', new Blob([payload], { type: 'application/json' }));
}

/**
 * saveReflectChat — async fetch with response.
 * Use for saves where the tab is staying open (TTL, manual save).
 */
export async function saveReflectChat({ chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration }) {
  return post('/api/reflect-chat-save', { chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration });
}

/**
 * getReflectChat — check if a specific chatId exists for this user.
 */
export async function getReflectChat(chatId, userId) {
  return get(`/api/reflect-chat-get?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`);
}

/**
 * saveAbandonedIfPending — called from practice.js after a session ends.
 * If there is an unsaved reflect chat in localStorage, fires sendBeacon
 * with action 'abandoned' and marks it saved.
 * No-op if already saved or no user messages exist.
 */
export function saveAbandonedIfPending(userId) {
  if (localStorage.getItem(LS_SAVED) === 'true') return;
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    const history = raw ? JSON.parse(raw) : [];
    if (!history.some(m => m.role === 'user')) return;
    const chatId = localStorage.getItem(LS_CHAT_ID) || generateReflectChatId();
    localStorage.setItem(LS_CHAT_ID, chatId);
    const payload = JSON.stringify({
      chatId,
      userId,
      messages: history,
      action: 'abandoned',
      conversationStart: history[0]?.timestamp || null,
      conversationEnd: new Date().toISOString(),
    });
    navigator.sendBeacon('/api/reflect-chat-save', new Blob([payload], { type: 'application/json' }));
    localStorage.setItem(LS_SAVED, 'true');
  } catch {}
}
