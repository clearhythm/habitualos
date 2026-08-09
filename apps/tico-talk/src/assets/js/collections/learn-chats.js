/**
 * saveLearnChatBeacon — fire-and-forget via sendBeacon.
 * Returns true if the browser accepted the request, false otherwise.
 * Use for pre-navigation saves (the 'exited' path — leaving the drill).
 */
export function saveLearnChatBeacon({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd }) {
  const payload = JSON.stringify({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd });
  return navigator.sendBeacon('/api/learn-chat-save', new Blob([payload], { type: 'application/json' }));
}

/**
 * saveLearnChat — async fetch with a response.
 * Use for saves where the tab is staying open ('learned', TTL-driven
 * 'abandoned' flush on load).
 */
export async function saveLearnChat({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd }) {
  const response = await fetch('/api/learn-chat-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd })
  });
  return response.json();
}

/**
 * getLearnChat — check whether a specific chatId was actually saved.
 * Used only by the load-time verify/retry safety net.
 */
export async function getLearnChat(chatId, userId) {
  const response = await fetch(`/api/learn-chat-get?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`);
  return response.json();
}
