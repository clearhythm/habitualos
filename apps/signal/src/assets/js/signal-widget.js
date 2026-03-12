/**
 * signal-widget.js
 * Chat widget for Signal — handles dynamic config loading, persona selection,
 * SSE streaming, FIT_SCORE_UPDATE parsing, and score panel animation.
 *
 * Phase 2: reads ?id= from URL to load any owner's Signal config.
 * Falls back to 'erik-burns' (hardcoded demo) if no id param.
 */

// ─── Resolve signalId from URL ────────────────────────────────────────────────

const urlParams = new URLSearchParams(window.location.search);
const signalId = urlParams.get('id') || 'erik-burns';

// ─── Storage keys (namespaced by signalId so multiple Signals don't collide) ──

const STORAGE_KEY = `signal-chat-${signalId}`;
const CHAT_ID_KEY = `signal-chat-id-${signalId}`;

// ─── State ────────────────────────────────────────────────────────────────────

let chatHistory = [];
let chatId = null;
let currentPersona = null;
let isStreaming = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const personaWrap   = document.getElementById('persona-wrap');
const personaPrompt = document.getElementById('persona-prompt');
const personaBtns   = document.getElementById('persona-btns');
const messagesEl    = document.getElementById('signal-messages');
const form          = document.getElementById('signal-form');
const input         = document.getElementById('signal-input');
const sendBtn       = document.getElementById('signal-send');

// Score panel
const overallScore   = document.getElementById('overall-score');
const overallRing    = document.getElementById('overall-ring');
const skillsBar      = document.getElementById('skills-bar');
const alignmentBar   = document.getElementById('alignment-bar');
const personalityBar = document.getElementById('personality-bar');
const skillsVal      = document.getElementById('skills-value');
const alignmentVal   = document.getElementById('alignment-value');
const personalityVal = document.getElementById('personality-value');
const confidenceBar  = document.getElementById('confidence-bar');
const confidencePct  = document.getElementById('confidence-pct');
const reasonEl       = document.getElementById('signal-reason');

// Ring geometry (r=52)
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
overallRing.style.strokeDasharray = RING_CIRCUMFERENCE;
overallRing.style.strokeDashoffset = RING_CIRCUMFERENCE;

// ─── Config loading ───────────────────────────────────────────────────────────

let ownerConfig = null;

async function loadConfig() {
  try {
    const res = await fetch('/api/signal-config-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId })
    });
    const data = await res.json();
    if (data.success) return data.config;
  } catch {}
  // Fallback: minimal Erik config (widget still works without Firestore)
  return {
    signalId: 'erik-burns',
    displayName: "Erik Burns",
    personas: [
      { key: 'recruiter', label: 'Recruiter' },
      { key: 'founder',   label: 'Founder' },
      { key: 'colleague', label: 'Colleague' },
      { key: 'curious',   label: 'Just curious' }
    ]
  };
}

function renderPersonaButtons(personas) {
  personaPrompt.textContent = "I'm an AI built on this person's work history. Who are you?";
  personaBtns.innerHTML = '';
  personas.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'signal-persona-btn';
    btn.dataset.persona = p.key;
    btn.textContent = p.label;
    btn.addEventListener('click', () => selectPersona(p.key));
    personaBtns.appendChild(btn);
  });
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

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

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `signal-message signal-message--${role}`;
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
}

function removeThinking() {
  document.getElementById('thinking-indicator')?.remove();
}

// ─── Score panel ──────────────────────────────────────────────────────────────

function updateScorePanel({ skills, alignment, personality, overall, confidence, reason }) {
  const pct = v => `${(v / 10) * 100}%`;
  skillsBar.style.width = pct(skills);
  alignmentBar.style.width = pct(alignment);
  personalityBar.style.width = pct(personality);
  skillsVal.textContent = skills;
  alignmentVal.textContent = alignment;
  personalityVal.textContent = personality;

  const offset = RING_CIRCUMFERENCE - (overall / 10) * RING_CIRCUMFERENCE;
  overallRing.style.strokeDashoffset = offset;
  overallScore.textContent = overall;

  confidenceBar.style.width = `${Math.round(confidence * 100)}%`;
  confidencePct.textContent = `${Math.round(confidence * 100)}%`;

  if (reason && confidence >= 0.4) {
    reasonEl.textContent = reason;
    reasonEl.classList.add('visible');
  }
}

// ─── Persona selection ────────────────────────────────────────────────────────

async function selectPersona(persona) {
  currentPersona = persona;
  personaWrap.style.display = 'none';
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();

  try {
    const res = await fetch('/api/signal-chat-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, signalId, persona })
    });
    const data = await res.json();
    if (data.opener) {
      chatHistory.push({ role: 'assistant', content: data.opener });
      appendMessage('assistant', data.opener);
      saveHistory();
    }
  } catch {
    appendMessage('assistant', "I'm ready. What brings you here?");
  }
}

// ─── Send message + SSE ───────────────────────────────────────────────────────

async function sendMessage(text) {
  if (isStreaming || !text.trim()) return;
  isStreaming = true;
  input.disabled = true;
  sendBtn.disabled = true;

  const userMsg = { role: 'user', content: text };
  chatHistory.push(userMsg);
  appendMessage('user', text);
  saveHistory();

  // History to send = everything except the just-added user msg (edge fn appends it)
  const historyForApi = chatHistory.slice(0, -1);

  showThinking();

  try {
    const res = await fetch('/api/signal-chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: window.__userId,
        chatType: 'signal',
        signalId,
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
          assistantEl.textContent = stripScoreBlock(fullResponse);
          messagesEl.scrollTop = messagesEl.scrollHeight;

        } else if (event.type === 'done') {
          fullResponse = event.fullResponse || fullResponse;
          if (event.hasSignal && event.signal?.type === 'FIT_SCORE_UPDATE') {
            updateScorePanel(event.signal.data);
          }
          const clean = stripScoreBlock(fullResponse);
          assistantEl.textContent = clean;
          chatHistory.push({ role: 'assistant', content: clean });
          saveHistory();
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

// ─── Textarea auto-resize ─────────────────────────────────────────────────────

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = input.value.trim();
    if (text) { input.value = ''; input.style.height = 'auto'; sendMessage(text); }
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) { input.value = ''; input.style.height = 'auto'; sendMessage(text); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  ownerConfig = await loadConfig();

  // Update page title with owner's name if available
  if (ownerConfig.displayName) {
    document.title = `Signal — ${ownerConfig.displayName}`;
  }

  const restored = loadHistory();

  if (restored && chatHistory.length > 0) {
    // Restore previous session
    personaWrap.style.display = 'none';
    input.disabled = false;
    sendBtn.disabled = false;
    chatHistory.forEach(msg => appendMessage(msg.role, msg.content));

    // Reset option
    const resetWrap = document.createElement('div');
    resetWrap.className = 'signal-reset-wrap';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'signal-reset-btn';
    resetBtn.textContent = 'Start new conversation';
    resetBtn.addEventListener('click', () => {
      clearHistory();
      chatHistory = []; chatId = null; currentPersona = null;
      messagesEl.innerHTML = '';
      personaWrap.style.display = '';
      input.disabled = true;
      sendBtn.disabled = true;
      renderPersonaButtons(ownerConfig.personas || []);
    });
    resetWrap.appendChild(resetBtn);
    messagesEl.prepend(resetWrap);
  } else {
    renderPersonaButtons(ownerConfig.personas || []);
  }
}

init();
