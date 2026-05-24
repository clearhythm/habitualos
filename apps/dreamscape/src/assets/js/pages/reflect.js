import { isSignedIn, getUserId } from '../auth/auth.js';
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
const userId       = getUserId();
const chatMessages = document.getElementById('chat-messages');
const chatForm     = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton   = document.getElementById('send-button');
const readyOverlay = document.getElementById('ready-overlay');
const beginBtn     = document.getElementById('begin-btn');
const keepChatBtn  = document.getElementById('keep-chatting-btn');

let chatHistory  = loadHistory();
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
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function showThinking() {
  thinkingEl = document.createElement('p');
  thinkingEl.className = 'chat-thinking';
  thinkingEl.textContent = 'Ruminating…';
  chatMessages.appendChild(thinkingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideThinking() {
  if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
}

function startStreaming() {
  hideThinking();
  streamingText = '';
  streamingEl = document.createElement('div');
  streamingEl.className = 'chat-bubble chat-bubble--assistant';
  chatMessages.appendChild(streamingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendStreamToken(text) {
  streamingText += text;
  streamingEl.innerHTML = escapeHtml(streamingText).replace(/\n/g, '<br>');
  chatMessages.scrollTop = chatMessages.scrollHeight;
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

// ─── Init

chatHistory.forEach((msg, i) => {
  const el = renderMessage(msg.role, msg.content);
  if (i === 0 && msg.role === 'assistant') el.classList.add('chat-bubble--intro');
});

if (chatHistory.length === 0) {
  const opening = {
    role: 'assistant',
    content: "What's present for you today?",
    timestamp: new Date().toISOString(),
  };
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content).classList.add('chat-bubble--intro');
}

messageInput.focus();
