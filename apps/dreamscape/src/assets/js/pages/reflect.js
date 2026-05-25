import { isSignedIn, getUserId, getName } from '../auth/auth.js';
import { getTimeOfDayGreeting } from '@habitualos/frontend-utils/utils.js';
import { log } from '../utils/log.js';

if (!isSignedIn() || !getUserId()?.startsWith('u-')) {
  window.location.replace('/signin/');
}

// ─── LocalStorage
const LS_HISTORY   = 'reflect-chat-history';
const LS_TIMESTAMP = 'reflect-chat-timestamp';
const LS_SAVED     = 'reflect-chat-saved';
const TTL_MS       = 24 * 60 * 60 * 1000;

function loadHistory() {
  try {
    const ts = localStorage.getItem(LS_TIMESTAMP);
    if (ts && Date.now() - parseInt(ts, 10) > TTL_MS) {
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
  [LS_HISTORY, LS_TIMESTAMP, LS_SAVED].forEach(k => localStorage.removeItem(k));
}

// ─── DOM
const userId         = getUserId();
const chatMessages   = document.getElementById('chat-messages');   // scroll container
const chatInner      = document.getElementById('chat-messages-inner'); // append target
const chatForm       = document.getElementById('chat-form');
const messageInput   = document.getElementById('message-input');
const sendButton     = document.getElementById('send-button');
const readyOverlay   = document.getElementById('ready-overlay');
const beginBtn       = document.getElementById('begin-btn');
const keepChatBtn    = document.getElementById('keep-chatting-btn');
const startFreshBtn  = document.getElementById('start-fresh-btn');

let chatHistory  = [];
let streamingEl  = null;
let streamingText = '';
let thinkingEl   = null;

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

function showReadyOverlay(practiceName, durationMins) {
  document.getElementById('ready-practice-name').textContent = practiceName;
  document.getElementById('ready-duration').textContent = `${durationMins} minute${durationMins !== 1 ? 's' : ''}`;
  beginBtn.href = `/practice/?practice=${encodeURIComponent(practiceName)}&duration=${durationMins}`;
  // Flag: clear chat on next visit (practice is starting)
  localStorage.setItem('dp-reflect-clear-next', '1');
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
          } else if (data.type === 'tool_complete' && data.tool === 'go_to_practice') {
            const { practiceName, durationMins } = data.result;
            showReadyOverlay(practiceName, durationMins);
          } else if (data.type === 'done') {
            // Always clear thinking — it may still be visible if no tokens fired (pure tool call)
            hideThinking();
            const text = finalizeStreaming();
            // Only persist non-empty assistant turns
            if (text.trim()) {
              chatHistory.push({ role: 'assistant', content: text, timestamp: new Date().toISOString() });
              saveHistory(chatHistory);
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

keepChatBtn.addEventListener('click', () => {
  readyOverlay.hidden = true;
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
});

// ─── Start fresh

startFreshBtn.addEventListener('click', () => {
  clearHistory();
  chatHistory = [];
  // Remove all message bubbles (keep the circle-header and start-fresh btn in place)
  chatInner.querySelectorAll('.chat-bubble, .chat-thinking').forEach(el => el.remove());
  startFreshBtn.hidden = true;
  const greeting  = getTimeOfDayGreeting();
  const firstName = getName().split(' ')[0] || null;
  const opening = {
    role: 'assistant',
    content: firstName
      ? `Good ${greeting} ${firstName}, what's present for you today?`
      : `Good ${greeting}, what's present for you today?`,
    timestamp: new Date().toISOString(),
  };
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content);
  chatMessages.scrollTo(0, 0);
  messageInput.focus();
});

// ─── Init

// Auto-clear if user completed a practice last time
if (localStorage.getItem('dp-reflect-clear-next') === '1') {
  localStorage.removeItem('dp-reflect-clear-next');
  clearHistory();
}

chatHistory = loadHistory();

chatHistory.forEach(msg => {
  renderMessage(msg.role, msg.content);
});

if (chatHistory.length > 0) {
  startFreshBtn.hidden = false;
}

if (chatHistory.length === 0) {
  const greeting   = getTimeOfDayGreeting();
  const firstName  = getName().split(' ')[0] || null;
  const opening = {
    role: 'assistant',
    content: firstName
      ? `Good ${greeting} ${firstName}, what's present for you today?`
      : `Good ${greeting}, what's present for you today?`,
    timestamp: new Date().toISOString(),
  };
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content);
}

messageInput.focus();
