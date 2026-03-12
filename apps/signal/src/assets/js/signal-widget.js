/**
 * signal-widget.js
 * Chat widget for Signal — handles persona selection, SSE streaming,
 * FIT_SCORE_UPDATE parsing, and score panel animation.
 */

const STORAGE_KEY = 'signal-chat';
const CHAT_ID_KEY = 'signal-chat-id';

// ─── State ────────────────────────────────────────────────────────────────────

let chatHistory = [];
let chatId = null;
let currentPersona = null;
let isStreaming = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const personaWrap   = document.getElementById('persona-wrap');
const messagesEl    = document.getElementById('signal-messages');
const form          = document.getElementById('signal-form');
const input         = document.getElementById('signal-input');
const sendBtn       = document.getElementById('signal-send');

// Score panel
const overallScore  = document.getElementById('overall-score');
const overallRing   = document.getElementById('overall-ring');
const skillsBar     = document.getElementById('skills-bar');
const alignmentBar  = document.getElementById('alignment-bar');
const personalityBar= document.getElementById('personality-bar');
const skillsVal     = document.getElementById('skills-value');
const alignmentVal  = document.getElementById('alignment-value');
const personalityVal= document.getElementById('personality-value');
const confidenceBar = document.getElementById('confidence-bar');
const confidencePct = document.getElementById('confidence-pct');
const reasonEl      = document.getElementById('signal-reason');

// Ring geometry
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52
overallRing.style.strokeDasharray = RING_CIRCUMFERENCE;
overallRing.style.strokeDashoffset = RING_CIRCUMFERENCE; // start empty

// ─── localStorage helpers ────────────────────────────────────────────────────

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ persona: currentPersona, messages: chatHistory }));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved.messages || saved.messages.length === 0) return false;
    currentPersona = saved.persona;
    chatHistory = saved.messages;
    chatId = localStorage.getItem(CHAT_ID_KEY) || null;
    return true;
  } catch {
    return false;
  }
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHAT_ID_KEY);
}

// ─── Message rendering ────────────────────────────────────────────────────────

function appendMessage(role, text, id) {
  const el = document.createElement('div');
  el.className = `signal-message signal-message--${role}`;
  if (id) el.id = id;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'signal-message signal-message--assistant signal-thinking';
  el.id = 'thinking-indicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function removeThinking() {
  const el = document.getElementById('thinking-indicator');
  if (el) el.remove();
}

// ─── Score panel updates ──────────────────────────────────────────────────────

function updateScorePanel({ skills, alignment, personality, overall, confidence, reason }) {
  // Dimension bars (0–10 → 0–100%)
  const pct = v => `${(v / 10) * 100}%`;

  skillsBar.style.width = pct(skills);
  alignmentBar.style.width = pct(alignment);
  personalityBar.style.width = pct(personality);

  skillsVal.textContent = skills;
  alignmentVal.textContent = alignment;
  personalityVal.textContent = personality;

  // Overall ring
  const offset = RING_CIRCUMFERENCE - (overall / 10) * RING_CIRCUMFERENCE;
  overallRing.style.strokeDashoffset = offset;
  overallScore.textContent = overall;

  // Confidence meter
  confidenceBar.style.width = `${Math.round(confidence * 100)}%`;
  confidencePct.textContent = `${Math.round(confidence * 100)}%`;

  // Reason (show when confidence ≥ 40%)
  if (reason && confidence >= 0.4) {
    reasonEl.textContent = reason;
    reasonEl.classList.add('visible');
  }
}

// ─── Persona selection ────────────────────────────────────────────────────────

async function selectPersona(persona) {
  currentPersona = persona;

  // Hide persona selector
  personaWrap.style.display = 'none';

  // Enable input
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();

  // Fetch opener from init endpoint
  try {
    const res = await fetch('/api/signal-chat-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, persona })
    });
    const data = await res.json();
    if (data.opener) {
      const msg = { role: 'assistant', content: data.opener };
      chatHistory.push(msg);
      appendMessage('assistant', data.opener);
      saveHistory();
    }
  } catch (err) {
    appendMessage('assistant', "I'm ready. What brings you here?");
  }
}

// ─── Send message + SSE ───────────────────────────────────────────────────────

async function sendMessage(text) {
  if (isStreaming || !text.trim()) return;
  isStreaming = true;
  input.disabled = true;
  sendBtn.disabled = true;

  // Add user message to history and UI
  const userMsg = { role: 'user', content: text };
  chatHistory.push(userMsg);
  appendMessage('user', text);
  saveHistory();

  // Show typing indicator
  showThinking();

  // Build chat history for API (exclude the opener which has no user turn yet)
  const historyForApi = chatHistory.slice(0, -1); // exclude the just-added user msg

  try {
    const res = await fetch('/api/signal-chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: window.__userId,
        chatType: 'signal',
        persona: currentPersona,
        message: text,
        chatHistory: historyForApi
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantEl = null;
    let fullResponse = '';

    removeThinking();
    assistantEl = appendMessage('assistant', '');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event;
        try { event = JSON.parse(raw); } catch { continue; }

        if (event.type === 'token') {
          fullResponse += event.text;
          // Strip FIT_SCORE_UPDATE block from visible text
          const visible = stripScoreBlock(fullResponse);
          assistantEl.textContent = visible;
          messagesEl.scrollTop = messagesEl.scrollHeight;

        } else if (event.type === 'done') {
          fullResponse = event.fullResponse || fullResponse;

          // Parse and apply score update if signal was found
          if (event.hasSignal && event.signal && event.signal.type === 'FIT_SCORE_UPDATE') {
            updateScorePanel(event.signal.data);
          }

          // Store clean response in history (without score block)
          const cleanResponse = stripScoreBlock(fullResponse);
          assistantEl.textContent = cleanResponse;
          const assistantMsg = { role: 'assistant', content: cleanResponse };
          chatHistory.push(assistantMsg);
          saveHistory();

          // Persist to Firestore
          saveChat(chatHistory);

        } else if (event.type === 'error') {
          removeThinking();
          appendMessage('assistant', 'Something went wrong. Please try again.');
        }
      }
    }

  } catch (err) {
    removeThinking();
    if (assistantEl) assistantEl.remove();
    appendMessage('assistant', 'Connection error. Please try again.');
    console.error('[signal-widget] Stream error:', err);
  }

  isStreaming = false;
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

// Strip the FIT_SCORE_UPDATE block from visible assistant text
function stripScoreBlock(text) {
  return text.replace(/\n*FIT_SCORE_UPDATE\s*\n---\s*\n\{[\s\S]*?\}/m, '').trim();
}

// ─── Chat persistence ─────────────────────────────────────────────────────────

async function saveChat(messages) {
  try {
    const mode = chatId ? 'append' : 'create';
    const body = { userId: window.__userId, messages, mode };
    if (chatId) body.chatId = chatId;

    const res = await fetch('/api/signal-chat-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.chatId && !chatId) {
      chatId = data.chatId;
      localStorage.setItem(CHAT_ID_KEY, chatId);
    }
  } catch (err) {
    console.warn('[signal-widget] Chat save failed (non-fatal):', err);
  }
}

// ─── Auto-resize textarea ─────────────────────────────────────────────────────

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      input.value = '';
      input.style.height = 'auto';
      sendMessage(text);
    }
  }
});

// ─── Form submit ──────────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    input.value = '';
    input.style.height = 'auto';
    sendMessage(text);
  }
});

// ─── Persona button clicks ────────────────────────────────────────────────────

document.querySelectorAll('.signal-persona-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectPersona(btn.dataset.persona);
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  const restored = loadHistory();

  if (restored && chatHistory.length > 0) {
    // Restore previous session
    personaWrap.style.display = 'none';
    input.disabled = false;
    sendBtn.disabled = false;

    // Re-render messages
    chatHistory.forEach(msg => appendMessage(msg.role, msg.content));

    // Add a reset option
    const resetEl = document.createElement('div');
    resetEl.className = 'signal-reset-wrap';
    resetEl.innerHTML = '<button class="signal-reset-btn" id="reset-btn">Start new conversation</button>';
    messagesEl.prepend(resetEl);

    document.getElementById('reset-btn').addEventListener('click', () => {
      clearHistory();
      chatHistory = [];
      chatId = null;
      currentPersona = null;
      messagesEl.innerHTML = '';
      personaWrap.style.display = '';
      input.disabled = true;
      sendBtn.disabled = true;
    });
  }
}

init();
