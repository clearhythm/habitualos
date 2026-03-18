/**
 * signal-demo.js
 * Signal Readiness demo — interviews the visitor about their own AI work history.
 * Simplified version of signal-widget.js: no persona selection, no Firestore persistence.
 */

// ─── State ────────────────────────────────────────────────────────────────────

let chatHistory = [];
let isStreaming = false;
let turnCount = 0;
let lastScore = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const personaWrap   = document.getElementById('persona-wrap');
const messagesEl    = document.getElementById('signal-messages');
const form          = document.getElementById('signal-form');
const input         = document.getElementById('signal-input');
const sendBtn       = document.getElementById('signal-send');

// Score panel
const overallWrap    = document.getElementById('overall-wrap');
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

// Compact mobile score bar
const scorePanelEl   = document.querySelector('.signal-panel--score');
const scoreBarMobile = document.getElementById('score-bar-mobile');
const scoreBarNum    = document.getElementById('score-bar-num');
const scoreBarLabel  = document.getElementById('score-bar-label');

// Next step panel
const nextStepEl      = document.getElementById('signal-next-step');

// Ring geometry (r=52)
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
overallRing.style.strokeDasharray = RING_CIRCUMFERENCE;
overallRing.style.strokeDashoffset = RING_CIRCUMFERENCE;

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

function showError(msg) {
  const el = document.createElement('p');
  el.className = 'signal-persona-prompt';
  el.textContent = msg;
  personaWrap.innerHTML = '';
  personaWrap.appendChild(el);
  personaWrap.style.display = '';
}

// ─── Score panel ──────────────────────────────────────────────────────────────

function updateScorePanel(data) {
  const { skills, alignment, personality, overall, confidence, reason, nextStep, nextStepLabel: label, turn } = data;

  lastScore = data;

  // Animate ring: enter on first score, pulse on updates
  if (overallWrap) {
    if (!overallWrap.classList.contains('is-visible')) {
      overallWrap.classList.add('is-visible');
    } else {
      overallWrap.classList.add('is-pulsing');
      overallWrap.addEventListener('animationend', () => {
        overallWrap.classList.remove('is-pulsing');
      }, { once: true });
    }
  }

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

  // Mobile: show compact score bar, hide full score panel
  if (window.innerWidth < 768 && scoreBarMobile) {
    scoreBarMobile.classList.add('is-visible');
    if (scoreBarNum) scoreBarNum.textContent = overall;
    if (scoreBarLabel) scoreBarLabel.textContent = Math.round(confidence * 100) + '% confidence';
    if (scorePanelEl) scorePanelEl.style.display = 'none';
  }

  // Show next step panel when confidence is high enough and conversation has depth
  const effectiveTurn = turn || turnCount;
  if (nextStep && label && confidence >= 0.65 && effectiveTurn >= 4) {
    renderNextStep(nextStep, label);
  }
}

function renderNextStep(step, label) {
  const labelEl = document.getElementById('next-step-label');
  const actionsEl = document.getElementById('next-step-actions');
  if (labelEl) labelEl.textContent = label;
  actionsEl.innerHTML = '';

  if (step === 'ready') {
    const btn = document.createElement('a');
    btn.href = '/waitlist/';
    btn.className = 'btn btn-primary';
    btn.textContent = 'Join the waitlist →';
    actionsEl.appendChild(btn);
  } else if (step === 'building') {
    const p = document.createElement('p');
    p.className = 'signal-next-step-body';
    p.textContent = 'Keep shipping. Strong Signal candidates have months of real, varied AI work. Come back when you have more to show.';
    actionsEl.appendChild(p);
  } else if (step === 'pass') {
    const p = document.createElement('p');
    p.className = 'signal-next-step-body';
    p.textContent = 'Signal may not be the right tool for you right now — but that can change. Dig deeper into your AI workflow and revisit.';
    actionsEl.appendChild(p);
  }

  if (nextStepEl) nextStepEl.hidden = false;
}

// ─── Strip score block from display text ─────────────────────────────────────

function stripScoreBlock(text) {
  return text.replace(/\n*FIT_SCORE_UPDATE\s*\n---\s*\n\{[\s\S]*?\}/m, '').trim();
}

// ─── Send message + SSE ───────────────────────────────────────────────────────

async function sendMessage(text) {
  if (isStreaming || !text.trim()) return;
  isStreaming = true;
  input.disabled = true;
  sendBtn.disabled = true;

  turnCount++;
  const userMsg = { role: 'user', content: text };
  chatHistory.push(userMsg);
  appendMessage('user', text);

  // History to send = everything except the just-added user msg (edge fn appends it)
  const historyForApi = chatHistory.slice(0, -1);

  showThinking();

  try {
    const res = await fetch('/api/signal-chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: window.__demoUserId,
        chatType: 'signal-demo',
        message: text,
        chatHistory: historyForApi,
      }),
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
    console.error('[signal-demo] Stream error:', err);
  }

  isStreaming = false;
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

// ─── Textarea auto-resize ─────────────────────────────────────────────────────

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

input.addEventListener('keydown', (e) => {
  const isMobile = window.innerWidth < 600;
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
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
  const VISITOR_KEY = 'signal_demo_visitor';
  let userId = localStorage.getItem(VISITOR_KEY);
  if (!userId) {
    userId = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(VISITOR_KEY, userId);
  }
  window.__demoUserId = userId;

  try {
    const res = await fetch('/api/signal-demo-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success) { showError('Could not start demo.'); return; }

    // Hide loading state, show opener
    personaWrap.style.display = 'none';
    appendMessage('assistant', data.opener);
    chatHistory.push({ role: 'assistant', content: data.opener });

    // Enable input
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  } catch (err) {
    showError('Could not start demo. Please refresh and try again.');
    console.error('[signal-demo] Init error:', err);
  }
}

init();
