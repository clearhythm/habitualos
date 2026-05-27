import { isSignedIn, getUserId, getName } from '../auth/auth.js';
import { getTimeOfDayGreeting } from '@habitualos/frontend-utils/utils.js';
import { log } from '../utils/log.js';
import { saveReflectChatBeacon, saveReflectChat, getReflectChat } from '../collections/reflect-chats.js';
import { generateReflectChatId } from '../utils/id.js';

if (!isSignedIn() || !getUserId()?.startsWith('u-')) {
  window.location.replace('/signin/');
}

// ─── LocalStorage
const LS_HISTORY      = 'reflect-chat-history';
const LS_TIMESTAMP    = 'reflect-chat-timestamp';
const LS_SAVED        = 'reflect-chat-saved';
const LS_CHAT_ID      = 'reflect-chat-id';
const LS_PENDING_ID   = 'reflect-chat-pending-id';
const LS_PENDING_META = 'reflect-chat-pending-meta';
const TTL_MS          = 4 * 60 * 60 * 1000;

function getOrCreateChatId() {
  let chatId = localStorage.getItem(LS_CHAT_ID);
  if (!chatId) {
    chatId = generateReflectChatId();
    localStorage.setItem(LS_CHAT_ID, chatId);
  }
  return chatId;
}

function loadHistory() {
  try {
    const ts = localStorage.getItem(LS_TIMESTAMP);
    if (ts && Date.now() - parseInt(ts, 10) > TTL_MS) {
      // Save abandoned chat before clearing — fetch is fine here (page-load context, no navigation race)
      const raw = localStorage.getItem(LS_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      if (history.some(m => m.role === 'user')) {
        persistChat({
          messages: history,
          action: 'abandoned',
          conversationStart: history[0]?.timestamp || null,
          conversationEnd: new Date().toISOString(),
        }).catch(() => {});
      }
      clearHistory();
      return [];
    }
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(history) {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    localStorage.setItem(LS_TIMESTAMP, String(Date.now()));
    localStorage.setItem(LS_SAVED, 'false');
  } catch {}
}

function clearHistory() {
  [LS_HISTORY, LS_TIMESTAMP, LS_SAVED, LS_CHAT_ID].forEach(k => localStorage.removeItem(k));
}

// ─── DOM
const userId         = getUserId();
const chatMessages   = document.getElementById('chat-messages');
const chatInner      = document.getElementById('chat-messages-inner');
const chatForm       = document.getElementById('chat-form');
const messageInput   = document.getElementById('message-input');
const sendButton     = document.getElementById('send-button');
const readyOverlay   = document.getElementById('ready-overlay');
const beginBtn       = document.getElementById('begin-btn');
const keepChatBtn    = document.getElementById('keep-chatting-btn');
const saveChatBtn    = document.getElementById('save-chat-btn');
const startFreshBtn  = document.getElementById('start-fresh-btn');

let chatHistory         = [];
let streamingEl         = null;
let streamingText       = '';
let thinkingEl          = null;
let pendingPracticeName = null;
let pendingPracticeDuration = null; // seconds
let _pendingAction      = null;     // action to persist after 'done' (e.g. 'non-practice')

// ─── Save helpers

/**
 * persistChat — single save path for all cases.
 * Reuses the conversation's chatId (or creates one), stores pending meta for
 * cross-session verification, and routes to sendBeacon or fetch.
 *
 * useBeacon: true  → sendBeacon (pre-navigation safe) with fetch fallback
 * useBeacon: false → fetch (returns promise, caller can await or .catch)
 *
 * messages defaults to chatHistory but can be overridden (e.g. TTL path
 * where chatHistory isn't populated yet).
 */
function persistChat({ messages, action, conversationStart, conversationEnd, practiceName = null, practiceDuration = null, useBeacon = false }) {
  const chatId = getOrCreateChatId();
  const payload = { chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration };

  // Always store pending meta — survives clearHistory(), enables retry on next load
  localStorage.setItem(LS_PENDING_ID, chatId);
  localStorage.setItem(LS_PENDING_META, JSON.stringify({ action, conversationStart, conversationEnd, practiceName, practiceDuration, messages }));
  localStorage.setItem(LS_SAVED, 'true');

  if (useBeacon) {
    const queued = saveReflectChatBeacon(payload);
    if (!queued) saveReflectChat(payload).catch(() => {});
    return null;
  }
  return saveReflectChat(payload);
}

/**
 * flushPendingSave — on page load, verify the previous session's sendBeacon save made it.
 * If not found, retries using stored meta. Runs async after page renders.
 * Note: LS_PENDING_META is separate from LS_HISTORY, so it survives clearHistory().
 */
async function flushPendingSave() {
  const pendingChatId = localStorage.getItem(LS_PENDING_ID);
  if (!pendingChatId) return;

  try {
    const { found } = await getReflectChat(pendingChatId, userId);
    if (!found) {
      const raw = localStorage.getItem(LS_PENDING_META);
      const meta = raw ? JSON.parse(raw) : null;
      if (meta?.messages?.some(m => m.role === 'user')) {
        log('debug', '[reflect] pending save not found — retrying chatId:', pendingChatId);
        await saveReflectChat({ chatId: pendingChatId, userId, ...meta }).catch(() => {});
      }
    }
  } catch {
    // Network error — leave flags for next visit
    return;
  }

  localStorage.removeItem(LS_PENDING_ID);
  localStorage.removeItem(LS_PENDING_META);
}

// ─── Helpers

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMessage(role, content) {
  const div = document.createElement('div');
  div.className = `chat-bubble chat-bubble--${role}`;
  div.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  chatInner.appendChild(div);
  chatMessages.scrollTo(0, chatMessages.scrollHeight);
  return div;
}

function showThinking() {
  thinkingEl = document.createElement('p');
  thinkingEl.className = 'chat-thinking';
  thinkingEl.textContent = 'Ruminating…';
  chatInner.appendChild(thinkingEl);
  chatMessages.scrollTo(0, chatMessages.scrollHeight);
}

function hideThinking() {
  if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
}

function startStreaming() {
  hideThinking();
  streamingText = '';
  streamingEl = document.createElement('div');
  streamingEl.className = 'chat-bubble chat-bubble--assistant';
  chatInner.appendChild(streamingEl);
  chatMessages.scrollTo(0, chatMessages.scrollHeight);
}

function appendStreamToken(text) {
  streamingText += text;
  streamingEl.innerHTML = escapeHtml(streamingText).replace(/\n/g, '<br>');
  chatMessages.scrollTo(0, chatMessages.scrollHeight);
}

function finalizeStreaming() {
  const text = streamingText;
  streamingEl = null;
  streamingText = '';
  return text;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m} minute${m !== 1 ? 's' : ''}`;
  return `${s} second${s !== 1 ? 's' : ''}`;
}

function showReadyOverlay(practiceName, durationSecs) {
  document.getElementById('ready-practice-name').textContent = practiceName;
  document.getElementById('ready-duration').textContent = formatDuration(durationSecs);
  beginBtn.href = `/practice/timer/?practice=${encodeURIComponent(practiceName)}&duration=${durationSecs}`;
  pendingPracticeName = practiceName;
  pendingPracticeDuration = durationSecs;
  readyOverlay.hidden = false;
  sendButton.disabled = true;
}

function updateSendButton() {
  sendButton.disabled = messageInput.value.trim().length === 0;
}

// ─── Stream

async function sendMessage(message) {
  renderMessage('user', message);
  chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
  saveHistory(chatHistory);
  saveChatBtn.hidden = false;
  startFreshBtn.hidden = false;

  sendButton.disabled = true;
  messageInput.disabled = true;

  showThinking();

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'reflect',
        userId,
        message,
        timezone,
        chatHistory: chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let started = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(part.slice(6));

          if (data.type === 'token') {
            if (!started) { startStreaming(); started = true; }
            appendStreamToken(data.text);
          } else if (data.type === 'tool_start') {
            if (streamingEl) streamingEl.classList.add('is-loading');
          } else if (data.type === 'tool_complete') {
            if (data.tool === 'go_to_practice') {
              if (streamingEl) streamingEl.classList.remove('is-loading');
              const { practiceName, durationSecs } = data.result;
              showReadyOverlay(practiceName, durationSecs);
            } else if (data.tool === 'end_conversation') {
              if (streamingEl) streamingEl.classList.remove('is-loading');
              // Defer persist until 'done' so the final assistant message is included
              _pendingAction = 'non-practice';
            } else if (streamingEl) {
              streamingEl.classList.remove('is-loading');
              if (streamingText) {
                streamingText += '\n\n';
                streamingEl.innerHTML = escapeHtml(streamingText).replace(/\n/g, '<br>');
              }
            }
          } else if (data.type === 'done') {
            hideThinking();
            const text = finalizeStreaming();
            if (text.trim()) {
              chatHistory.push({ role: 'assistant', content: text, timestamp: new Date().toISOString() });
              saveHistory(chatHistory);
            }
            // Persist deferred action now that the final message is in history
            if (_pendingAction && chatHistory.some(m => m.role === 'user')) {
              persistChat({
                messages: chatHistory,
                action: _pendingAction,
                conversationStart: chatHistory[0]?.timestamp || null,
                conversationEnd: new Date().toISOString(),
                useBeacon: true,
              });
              _pendingAction = null;
            }
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        } catch (parseErr) {
          log('warn', '[reflect] SSE parse error:', parseErr);
        }
      }
    }
  } catch (err) {
    log('warn', '[reflect] stream error:', err.message);
    hideThinking();
    if (streamingEl) { streamingEl.remove(); streamingEl = null; }
    renderMessage('assistant', 'Something went quiet. Try again.');
  }

  sendButton.disabled = false;
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
}

// ─── Events

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message || sendButton.disabled) return;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  updateSendButton();
  await sendMessage(message);
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  }
});

messageInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
  updateSendButton();
});

beginBtn.addEventListener('click', () => {
  if (!chatHistory.some(m => m.role === 'user')) return;
  persistChat({
    messages: chatHistory,
    action: 'practice',
    conversationStart: chatHistory[0]?.timestamp || null,
    conversationEnd: new Date().toISOString(),
    practiceName: pendingPracticeName,
    practiceDuration: pendingPracticeDuration,
    useBeacon: true,
  });
});

keepChatBtn.addEventListener('click', () => {
  readyOverlay.hidden = true;
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
});

// ─── Greeting

function buildOpening() {
  const tod      = getTimeOfDayGreeting();
  const timeTail = tod === 'morning' ? 'this morning'
                 : tod === 'evening' ? 'this evening'
                 : tod === 'night'   ? 'tonight'
                 : 'today';
  const firstName = getName().split(' ')[0] || null;
  const content = firstName
    ? `Welcome ${firstName}, what's present for you ${timeTail}?`
    : `Welcome, what's present for you ${timeTail}?`;
  return { role: 'assistant', content, timestamp: new Date().toISOString() };
}

// ─── Save chat (manual fallback — fires with action 'non-practice', fetch is fine here)

saveChatBtn.addEventListener('click', async () => {
  if (!chatHistory.some(m => m.role === 'user')) return;
  saveChatBtn.disabled = true;
  saveChatBtn.setAttribute('data-tooltip', 'Saving…');
  try {
    await persistChat({
      messages: chatHistory,
      action: 'non-practice',
      conversationStart: chatHistory[0]?.timestamp || null,
      conversationEnd: new Date().toISOString(),
    });
    saveChatBtn.setAttribute('data-tooltip', 'Saved');
    setTimeout(() => saveChatBtn.setAttribute('data-tooltip', 'Save this conversation'), 2000);
  } catch {
    saveChatBtn.setAttribute('data-tooltip', 'Save failed');
    setTimeout(() => saveChatBtn.setAttribute('data-tooltip', 'Save this conversation'), 2000);
  }
  saveChatBtn.disabled = false;
});

// ─── Start fresh

startFreshBtn.addEventListener('click', () => {
  clearHistory();
  chatHistory = [];
  chatInner.querySelectorAll('.chat-bubble, .chat-thinking').forEach(el => el.remove());
  saveChatBtn.hidden = true;
  startFreshBtn.hidden = true;
  const opening = buildOpening();
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content);
  chatMessages.scrollTo(0, 0);
  messageInput.focus();
});

// ─── Init

// If the conversation was saved (concluded or practiced), clear and start fresh
if (localStorage.getItem(LS_SAVED) === 'true') {
  clearHistory();
}

chatHistory = loadHistory();

// If no user messages exist, the session never started — regenerate the greeting fresh
if (!chatHistory.some(m => m.role === 'user')) {
  clearHistory();
  chatHistory = [];
}

chatHistory.forEach(msg => {
  renderMessage(msg.role, msg.content);
});

if (chatHistory.some(m => m.role === 'user')) {
  saveChatBtn.hidden = false;
  startFreshBtn.hidden = false;
}

if (chatHistory.length === 0) {
  const opening = buildOpening();
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content);
}

messageInput.focus();

// Async: verify previous session's sendBeacon save — retry silently if it didn't land
flushPendingSave().catch(() => {});
