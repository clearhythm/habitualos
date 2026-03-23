/**
 * signal-modal.js
 * Unified modal driver using sub-agent pattern.
 * Three modes: onboard | visitor | owner
 * Transition between modes via transition() — only path into any mode.
 */

import { apiUrl } from './api.js';

// ─── DOM refs (queried at parse time — modal HTML guaranteed by {% if showDemoModal %}) ──

const personaWrapEl    = document.getElementById('persona-wrap');
const personaPromptEl  = document.getElementById('persona-prompt');
const personaBtnsEl    = document.getElementById('persona-btns');
const messagesEl       = document.getElementById('signal-messages');
const formEl           = document.getElementById('signal-form');
const inputEl          = document.getElementById('signal-input');
const sendBtnEl        = document.getElementById('signal-send');

// Score panel
const overallWrapEl    = document.getElementById('overall-wrap');
const overallScoreEl   = document.getElementById('overall-score');
const overallRingEl    = document.getElementById('overall-ring');
const skillsBarEl      = document.getElementById('skills-bar');
const alignmentBarEl   = document.getElementById('alignment-bar');
const personalityBarEl = document.getElementById('personality-bar');
const skillsValEl      = document.getElementById('skills-value');
const alignmentValEl   = document.getElementById('alignment-value');
const personalityValEl = document.getElementById('personality-value');
const confidenceBarEl  = document.getElementById('confidence-bar');
const confidencePctEl  = document.getElementById('confidence-pct');
const reasonEl         = document.getElementById('signal-reason');

// Compact mobile score bar
const scorePanelEl    = document.querySelector('.signal-panel--score');
const scoreBarMobile  = document.getElementById('score-bar-mobile');
const scoreBarNumEl   = document.getElementById('score-bar-num');
const scoreBarLabelEl = document.getElementById('score-bar-label');

// Next step panel
const nextStepEl        = document.getElementById('signal-next-step');
const nextStepLabelEl   = document.getElementById('next-step-label');
const nextStepActionsEl = document.getElementById('next-step-actions');

// Modal header
const modalTitleEl      = document.querySelector('.signal-modal-title');
const scoreLabelEl      = document.getElementById('signal-score-label');

// Ring geometry (r=52)
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
overallRingEl.style.strokeDasharray = RING_CIRCUMFERENCE;
overallRingEl.style.strokeDashoffset = RING_CIRCUMFERENCE;

// ─── Shared mutable state ─────────────────────────────────────────────────────

let activeAgent = null;
let state = {
  mode: null,
  signalId: null,
  userId: null,
  chatHistory: [],
  chatId: null,
  currentPersona: null,
  isStreaming: false,
  turnCount: 0,
  lastScore: null,
  ownerConfig: null,
  currentEvalId: null,  // tracks open evaluation for upsert
};

// ─── Evaluation persistence ────────────────────────────────────────────────────

async function createEvalRecord({ roleTitle, summary, scores } = {}) {
  if (!state.signalId) return;
  try {
    const res = await fetch(apiUrl('/api/signal-evaluation-save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: state.signalId,
        userId: state.userId,
        mode: state.mode,
        roleTitle: roleTitle || null,
        summary: summary || null,
        scores: scores || null,
      }),
    });
    const data = await res.json();
    if (data.success) state.currentEvalId = data.evalId;
  } catch (err) {
    console.warn('[signal-modal] eval create failed (non-fatal):', err);
  }
}

function upsertEvalScores(scores) {
  if (!state.currentEvalId || !state.signalId) return;
  fetch(apiUrl('/api/signal-evaluation-save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evalId: state.currentEvalId, signalId: state.signalId, scores }),
  }).catch(() => {});  // fire and forget
}

// ─── Shared: message rendering ────────────────────────────────────────────────

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return marked.parse(text, { breaks: true });
}

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `signal-message signal-message--${role}`;
  if (role === 'assistant') {
    el.innerHTML = renderMarkdown(text);
  } else {
    el.textContent = text;
  }
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

// ─── Shared: score panel ──────────────────────────────────────────────────────

function resetScorePanel() {
  overallRingEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
  overallScoreEl.textContent = '—';
  skillsBarEl.style.width = '0%';
  alignmentBarEl.style.width = '0%';
  personalityBarEl.style.width = '0%';
  skillsValEl.textContent = '—';
  alignmentValEl.textContent = '—';
  personalityValEl.textContent = '—';
  confidenceBarEl.style.width = '0%';
  confidencePctEl.textContent = '—';
  reasonEl.textContent = '';
  reasonEl.classList.remove('visible');
  if (overallWrapEl) overallWrapEl.classList.remove('is-visible', 'is-pulsing');
  if (scoreBarMobile) scoreBarMobile.classList.remove('is-visible');
  if (scorePanelEl) scorePanelEl.style.display = '';
}

function updateScorePanel(data) {
  const { skills, alignment, personality, confidence, reason, nextStep, nextStepLabel: label, turn } = data;
  const overall = Math.round(skills * 0.50 + alignment * 0.35 + personality * 0.15);
  state.lastScore = data;

  if (overallWrapEl) {
    if (!overallWrapEl.classList.contains('is-visible')) {
      overallWrapEl.classList.add('is-visible');
    } else {
      overallWrapEl.classList.add('is-pulsing');
      overallWrapEl.addEventListener('animationend', () => {
        overallWrapEl.classList.remove('is-pulsing');
      }, { once: true });
    }
  }

  const pct = v => `${(v / 10) * 100}%`;
  skillsBarEl.style.width = pct(skills);
  alignmentBarEl.style.width = pct(alignment);
  personalityBarEl.style.width = pct(personality);
  skillsValEl.textContent = skills;
  alignmentValEl.textContent = alignment;
  personalityValEl.textContent = personality;

  const offset = RING_CIRCUMFERENCE - (overall / 10) * RING_CIRCUMFERENCE;
  overallRingEl.style.strokeDashoffset = offset;
  overallScoreEl.textContent = overall;

  confidenceBarEl.style.width = `${Math.round(confidence * 100)}%`;
  confidencePctEl.textContent = `${Math.round(confidence * 100)}%`;

  reasonEl.textContent = '';
  reasonEl.classList.remove('visible');

  if (window.innerWidth < 768 && scoreBarMobile) {
    scoreBarMobile.classList.add('is-visible');
    if (scoreBarNumEl) scoreBarNumEl.textContent = overall;
    if (scoreBarLabelEl) scoreBarLabelEl.textContent = Math.round(confidence * 100) + '% confidence';
    if (scorePanelEl) scorePanelEl.style.display = 'none';
  }

  if (nextStep && label && confidence >= 0.65) {
    if (activeAgent?.renderNextStep) {
      activeAgent.renderNextStep(nextStep, label);
    }
  }
}

// ─── Sub-agents ───────────────────────────────────────────────────────────────

const AGENTS = {

  // ── onboard: scores the visitor for Signal readiness ─────────────────────────
  onboard: {
    async init() {
      const VISITOR_KEY = 'signal_demo_visitor';
      let userId = localStorage.getItem(VISITOR_KEY);
      if (!userId) {
        userId = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(VISITOR_KEY, userId);
      }
      state.userId = userId;
      personaWrapEl.style.display = '';
      personaPromptEl.textContent = 'Loading…';
      personaBtnsEl.innerHTML = '';

      try {
        const res = await fetch(apiUrl('/api/signal-onboard-init'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!data.success) throw new Error('Init failed');
        personaWrapEl.style.display = 'none';
        appendMessage('assistant', data.opener);
        state.chatHistory.push({ role: 'assistant', content: data.opener });
        inputEl.disabled = false;
        sendBtnEl.disabled = false;
        inputEl.focus();
      } catch (err) {
        personaPromptEl.textContent = 'Could not start. Please refresh and try again.';
        console.error('[signal-modal/onboard] Init error:', err);
      }
    },

    buildPayload(text) {
      return {
        userId: state.userId,
        chatType: 'signal-onboard',
        message: text,
        chatHistory: state.chatHistory.slice(0, -1),
      };
    },

    renderNextStep(step, label) {
      nextStepLabelEl.textContent = label;
      nextStepActionsEl.innerHTML = '';
      if (step === 'ready') {
        const a = document.createElement('a');
        a.href = '/waitlist/';
        a.className = 'btn btn-primary';
        a.textContent = 'Join the waitlist →';
        nextStepActionsEl.appendChild(a);
      } else if (step === 'building') {
        const p = document.createElement('p');
        p.className = 'signal-next-step-body';
        p.textContent = 'Keep shipping. Strong Signal candidates have months of real, varied AI work. Come back when you have more to show.';
        nextStepActionsEl.appendChild(p);
      } else if (step === 'pass') {
        const p = document.createElement('p');
        p.className = 'signal-next-step-body';
        p.textContent = 'Signal may not be the right tool for you right now — but that can change. Dig deeper into your AI workflow and revisit.';
        nextStepActionsEl.appendChild(p);
      }
      nextStepEl.hidden = false;
    },

    persist: null,
  },

  // ── visitor: fits the visitor against an owner's Signal profile ───────────────
  visitor: {
    _fallbackConfig(signalId) {
      return {
        signalId,
        displayName: '',
        personas: [
          { key: 'recruiter', label: 'Recruiter' },
          { key: 'founder',   label: 'Founder' },
          { key: 'colleague', label: 'Colleague' },
          { key: 'curious',   label: 'Just curious' },
        ],
        contactLinks: {},
      };
    },

    async _selectPersona(persona) {
      state.currentPersona = persona;
      personaWrapEl.style.display = 'none';
      inputEl.disabled = false;
      sendBtnEl.disabled = false;
      inputEl.focus();
      try {
        const res = await fetch(apiUrl('/api/signal-visitor-init'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: state.userId, signalId: state.signalId, persona }),
        });
        const data = await res.json();
        if (data.displayName && modalTitleEl) {
          modalTitleEl.textContent = data.displayName;
        }
        if (data.opener) {
          state.chatHistory.push({ role: 'assistant', content: data.opener });
          appendMessage('assistant', data.opener);
        }
      } catch {
        appendMessage('assistant', "I'm ready. What brings you here?");
      }
    },

    async init() {
      state.userId = window.__userId;
      personaWrapEl.style.display = '';
      personaPromptEl.textContent = 'Loading…';
      personaBtnsEl.innerHTML = '';

      try {
        const res = await fetch(apiUrl('/api/signal-config-get'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId: state.signalId }),
        });
        const data = await res.json();
        state.ownerConfig = data.success ? data.config : AGENTS.visitor._fallbackConfig(state.signalId);
      } catch {
        state.ownerConfig = AGENTS.visitor._fallbackConfig(state.signalId);
      }

      personaPromptEl.textContent = "I'm an AI built on this person's work history. Who are you?";
      (state.ownerConfig.personas || []).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'signal-persona-btn';
        btn.dataset.persona = p.key;
        btn.textContent = p.label;
        btn.addEventListener('click', () => AGENTS.visitor._selectPersona(p.key));
        personaBtnsEl.appendChild(btn);
      });
    },

    buildPayload(text) {
      return {
        userId: state.userId,
        chatType: 'signal-visitor',
        signalId: state.signalId,
        persona: state.currentPersona,
        message: text,
        chatHistory: state.chatHistory.slice(0, -1),
      };
    },

    renderNextStep(step, label) {
      nextStepLabelEl.textContent = label;
      nextStepActionsEl.innerHTML = '';
      const links = state.ownerConfig?.contactLinks || {};

      if (step === 'hot') {
        // Hot (8-10): book a call + connect
        if (links.calendar) {
          const a = document.createElement('a');
          a.href = links.calendar;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'btn btn-primary signal-next-btn';
          a.textContent = 'Book a call →';
          nextStepActionsEl.appendChild(a);
        }
        if (links.linkedin) {
          const a = document.createElement('a');
          a.href = links.linkedin;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'btn signal-next-btn';
          a.textContent = 'Connect on LinkedIn →';
          nextStepActionsEl.appendChild(a);
        }
      } else if (step === 'warm') {
        // Warm (6-7): add to network
        if (links.linkedin) {
          const a = document.createElement('a');
          a.href = links.linkedin;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'btn signal-next-btn';
          a.textContent = 'Add to network →';
          nextStepActionsEl.appendChild(a);
        }
        if (links.substack) {
          const a = document.createElement('a');
          a.href = links.substack;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'btn signal-next-btn';
          a.textContent = 'Follow on Substack →';
          nextStepActionsEl.appendChild(a);
        }
      }
      // 'cold' (0-5): label only, no action buttons
      nextStepEl.hidden = false;
    },

    async persist() {
      try {
        const mode = state.chatId ? 'append' : 'create';
        const body = { userId: state.userId, messages: state.chatHistory, mode };
        if (state.chatId) body.chatId = state.chatId;
        const res = await fetch(apiUrl('/api/signal-chat-save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.chatId && !state.chatId) {
          state.chatId = data.chatId;
        }
      } catch (err) {
        console.warn('[signal-modal/visitor] Chat save failed (non-fatal):', err);
      }
    },
  },

  // ── owner: diagnostic mode for the Signal profile owner ──────────────────────
  owner: {
    async init() {
      state.userId = window.__userId;
      personaWrapEl.style.display = 'none';
      try {
        const res = await fetch(apiUrl('/api/signal-owner-init'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId: state.signalId }),
        });
        const data = await res.json();
        if (data.displayName && modalTitleEl) {
          modalTitleEl.innerHTML = `${data.displayName} <span class="signal-modal-owner-badge">owner</span>`;
        }
        if (data.opener) {
          state.chatHistory.push({ role: 'assistant', content: data.opener });
          appendMessage('assistant', data.opener);
        }
        inputEl.disabled = false;
        sendBtnEl.disabled = false;
        inputEl.focus();
      } catch (err) {
        appendMessage('assistant', 'Owner mode ready.');
        inputEl.disabled = false;
        sendBtnEl.disabled = false;
        console.error('[signal-modal/owner] Init error:', err);
      }
    },

    buildPayload(text) {
      return {
        userId: state.userId,
        chatType: 'signal-owner',
        signalId: state.signalId,
        message: text,
        chatHistory: state.chatHistory.slice(0, -1),
      };
    },

    renderNextStep: null,
    persist: null,
  },
};

// ─── Orchestrator: transition ─────────────────────────────────────────────────

async function transition(modeName, options = {}) {
  const newSignalId = options.signalId || null;
  // No-op if same mode + same signalId — continue existing session
  if (activeAgent && state.mode === modeName && state.signalId === newSignalId) return;

  // Reset UI
  messagesEl.innerHTML = '';
  resetScorePanel();
  personaBtnsEl.innerHTML = '';
  personaWrapEl.style.display = '';
  nextStepEl.hidden = true;
  inputEl.disabled = true;
  sendBtnEl.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  // Reset modal header and score label
  if (modalTitleEl) {
    modalTitleEl.innerHTML = modeName === 'owner'
      ? 'Signal Fit <span class="signal-modal-owner-badge">owner</span>'
      : 'Signal Fit';
  }
  if (scoreLabelEl) scoreLabelEl.textContent = 'Summary of Scores';
  if (modeName === 'owner') {
    inputEl.placeholder = 'Paste a job description to score your fit…';
  } else {
    inputEl.placeholder = 'Tell me about your AI work…';
  }

  // Reset state
  state = {
    mode: modeName,
    signalId: newSignalId,
    userId: null,
    chatHistory: [],
    chatId: null,
    currentPersona: null,
    isStreaming: false,
    turnCount: 0,
    lastScore: null,
    ownerConfig: null,
    currentEvalId: null,
  };

  activeAgent = AGENTS[modeName];
  await activeAgent.init();
}

// ─── Orchestrator: sendMessage ────────────────────────────────────────────────

async function sendMessage(text) {
  if (state.isStreaming || !text.trim() || !activeAgent) return;
  state.isStreaming = true;
  inputEl.disabled = true;
  sendBtnEl.disabled = true;

  state.turnCount++;
  state.chatHistory.push({ role: 'user', content: text });
  appendMessage('user', text);

  showThinking();

  let assistantEl = null;
  let fullResponse = '';
  let evaluationRendered = false;

  try {
    const payload = activeAgent.buildPayload(text);
    const res = await fetch(apiUrl('/api/signal-chat-stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Don't create the message el yet — wait for done to render formatted HTML

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
          // Buffer silently — render on done to avoid raw markdown flash
        } else if (event.type === 'tool_complete') {
          if (event.tool === 'show_evaluation') {
            evaluationRendered = true;
            const { roleTitle, summary, skills, alignment, personality } = event.result || {};
            const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const el = appendMessage('assistant', '');
            el.innerHTML = `
              <div class="eval-output">
                <h2 class="eval-output-heading">Fit Score</h2>
                <h3 class="eval-output-role">${esc(roleTitle)}</h3>
                <p class="eval-output-summary">${esc(summary)}</p>
                <h3 class="eval-output-breakdown">Detailed Breakdown</h3>
                <div class="eval-output-dims">
                  <div class="eval-output-dim"><strong>Skills</strong><p>${esc(skills)}</p></div>
                  <div class="eval-output-dim"><strong>Alignment</strong><p>${esc(alignment)}</p></div>
                  <div class="eval-output-dim"><strong>Personality</strong><p>${esc(personality)}</p></div>
                </div>
              </div>`;
            messagesEl.scrollTop = messagesEl.scrollHeight;
            // Persist to signal-evaluations (JD path) — scores arrive via update_fit_score
            createEvalRecord({ roleTitle, summary });
          } else if (event.tool === 'update_fit_score') {
            const { skills, alignment, personality, overall, confidence, reason, nextStep } = event.result || {};
            const nextStepLabels = {
              hot: 'Hot fit — worth prioritizing',
              warm: 'Warm fit — worth staying connected',
              cold: 'Probably not the right fit right now',
              ready: "You're Signal-ready",
              building: 'Keep building your history',
              pass: 'Signal may not be the right fit yet',
            };
            updateScorePanel({ skills, alignment, personality, overall, confidence, reason, nextStep, nextStepLabel: nextStepLabels[nextStep] || null });
            // Upsert scores onto open eval record if one exists
            if (state.currentEvalId) {
              upsertEvalScores({ skills, alignment, personality, confidence });
            }
          }
        } else if (event.type === 'done') {
          fullResponse = event.fullResponse || fullResponse;
          removeThinking();
          if (!evaluationRendered && fullResponse.trim()) {
            assistantEl = appendMessage('assistant', '');
            assistantEl.innerHTML = renderMarkdown(fullResponse);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          state.chatHistory.push({ role: 'assistant', content: fullResponse });
          // Conversational path: no JD was pasted but confidence is sufficient — create record now
          if (!state.currentEvalId && state.lastScore && state.lastScore.confidence >= 0.5) {
            const { skills, alignment, personality, confidence } = state.lastScore;
            createEvalRecord({ scores: { skills, alignment, personality, confidence } });
          } else if (state.currentEvalId && state.lastScore) {
            // Final upsert with latest scores at end of turn
            const { skills, alignment, personality, confidence } = state.lastScore;
            upsertEvalScores({ skills, alignment, personality, confidence });
          }
          if (activeAgent.persist) await activeAgent.persist();
        } else if (event.type === 'error') {
          removeThinking();
          appendMessage('assistant', 'Something went wrong. Please try again.');
        }
      }
    }

  } catch (err) {
    removeThinking();
    if (assistantEl) assistantEl.remove();
    else if (fullResponse) { assistantEl = appendMessage('assistant', ''); assistantEl.innerHTML = renderMarkdown(fullResponse); }
    appendMessage('assistant', 'Connection error. Please try again.');
    console.error('[signal-modal] Stream error:', err);
  }

  state.isStreaming = false;
  inputEl.disabled = false;
  sendBtnEl.disabled = false;
  inputEl.focus();
}

// ─── Textarea auto-resize + submit ────────────────────────────────────────────

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  const isMobile = window.innerWidth < 600;
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (text) { inputEl.value = ''; inputEl.style.height = 'auto'; sendMessage(text); }
  }
});

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (text) { inputEl.value = ''; inputEl.style.height = 'auto'; sendMessage(text); }
});

// ─── Public API ───────────────────────────────────────────────────────────────

// Called by buttons on homepage, test page, and by embed.js
window.signalOpen = function(options = {}) {
  if (window.signalModalOpen) window.signalModalOpen();
  const modeName = options.mode || (options.signalId ? 'visitor' : 'onboard');
  transition(modeName, options);
};

// Called to switch modes mid-session (e.g. chat command → owner mode)
window.signalSwitchMode = function(modeName, options = {}) {
  transition(modeName, options);
};
