/**
 * signal-modal.js
 * Unified modal driver using sub-agent pattern.
 * Three modes: onboard | visitor | owner
 * Transition between modes via transition() — only path into any mode.
 */

import { apiUrl } from './api.js';

const BREAKPOINT_MD = 768;

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
const confidenceSectionEl = document.querySelector('.signal-confidence-section');
const reasonEl         = document.getElementById('signal-reason');

// Compact mobile score bar (legacy — kept for DOM ref only)
const scorePanelEl    = document.querySelector('.signal-panel--score');
const scoreBarMobile  = document.getElementById('score-bar-mobile');
const scoreBarNumEl   = document.getElementById('score-bar-num');
const scoreBarLabelEl = document.getElementById('score-bar-label');

// Mobile compact header
const mobileHeaderEl    = document.getElementById('signal-mobile-header');
const mobileAgentNameEl = document.getElementById('mobile-agent-name');
const mobileScorePillEl = document.getElementById('mobile-score-pill');

// Recommendation label
const recommendationEl  = document.getElementById('signal-recommendation');

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
  currentEvalId: null,
  agentAvatarUrl: null,
  profileCompacted: false,
};

// Left panel phase refs
const agentIntroEl  = document.getElementById('signal-agent-left');
const scoreInnerEl  = document.getElementById('signal-score-inner');
const scoreTabEl    = document.getElementById('tab-score');
const scoreTabBadge = document.getElementById('tab-score-badge');

function switchTab(name) {
  document.querySelectorAll('.signal-tab').forEach(t => t.classList.remove('is-active'));
  const activeTab = document.querySelector(`[data-tab="${name}"]`);
  activeTab?.classList.add('is-active');
  if (name === 'score') {
    agentIntroEl?.classList.add('is-done');
    scoreInnerEl?.classList.add('is-active');
  } else {
    agentIntroEl?.classList.remove('is-done');
    scoreInnerEl?.classList.remove('is-active');
  }
}

document.querySelectorAll('.signal-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

mobileHeaderEl?.addEventListener('click', () => {
  scorePanelEl?.classList.toggle('is-expanded');
});

// ─── Evaluation persistence ────────────────────────────────────────────────────

async function createEvalRecord({ roleTitle, summary, scores, strengths, gaps } = {}) {
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
        strengths: strengths || null,
        gaps: gaps || null,
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
    const content = document.createElement('div');
    content.className = 'signal-message-content';
    content.innerHTML = renderMarkdown(text);
    el.appendChild(content);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return content;
  } else {
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'signal-message signal-message--assistant signal-thinking';
  el.id = 'thinking-indicator';
  el.innerHTML = `<div class="signal-message-content"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeThinking() {
  document.getElementById('thinking-indicator')?.remove();
}

// ─── Shared: score panel ──────────────────────────────────────────────────────

function resetScorePanel() {
  overallRingEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
  overallScoreEl.textContent = '';
  skillsBarEl.style.width = '0%';
  alignmentBarEl.style.width = '0%';
  personalityBarEl.style.width = '0%';
  skillsValEl.textContent = '';
  alignmentValEl.textContent = '';
  personalityValEl.textContent = '';
  if (confidenceBarEl) confidenceBarEl.style.width = '0%';
  confidencePctEl.textContent = '';
  if (confidenceSectionEl) confidenceSectionEl.hidden = true;
  reasonEl.textContent = '';
  reasonEl.classList.remove('visible');
  if (overallWrapEl) overallWrapEl.classList.remove('is-visible', 'is-pulsing');
  if (mobileScorePillEl) mobileScorePillEl.textContent = '';
  if (recommendationEl) { recommendationEl.textContent = ''; recommendationEl.hidden = true; }
}

function updateScorePanel(data) {
  const { skills, alignment, personality, confidence, reason } = data;
  const overall = Math.round(skills * 0.50 + alignment * 0.35 + personality * 0.15);
  state.lastScore = data;

  // Auto-switch to score on first score, update badge
  if (!scoreInnerEl.classList.contains('is-active')) {
    switchTab('score');
  }
  if (scoreTabBadge) scoreTabBadge.textContent = overall;

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

  if (confidenceBarEl) confidenceBarEl.style.width = `${Math.round(confidence * 100)}%`;
  confidencePctEl.textContent = `${Math.round(confidence * 100)}%`;
  if (confidenceSectionEl) confidenceSectionEl.hidden = false;

  reasonEl.textContent = '';
  reasonEl.classList.remove('visible');

  if (mobileScorePillEl) mobileScorePillEl.textContent = overall;

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
      personaWrapEl.style.display = 'none';


      // Fetch config + context-status in parallel
      const [configResult, statusResult] = await Promise.allSettled([
        fetch(apiUrl('/api/signal-config-get'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId: state.signalId }),
        }).then(r => r.json()),
        fetch(apiUrl('/api/signal-context-status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId: state.signalId }),
        }).then(r => r.json()),
      ]);

      const config = configResult.status === 'fulfilled' && configResult.value.success
        ? configResult.value.config
        : AGENTS.visitor._fallbackConfig(state.signalId);
      state.ownerConfig = config;

      const total = statusResult.status === 'fulfilled' && statusResult.value.success
        ? statusResult.value.stats?.total : null;

      // Populate left panel agent intro
      const name = config.displayName || state.signalId;
      state.agentAvatarUrl = config.avatarUrl || config.agentAvatarUrl || '/assets/images/signal-agent.png';
      const agentNameEl = document.getElementById('signal-agent-left-name');
      if (agentNameEl) agentNameEl.textContent = `${name.split(' ')[0]}'s Agent`;
      if (mobileAgentNameEl) mobileAgentNameEl.textContent = `${name.split(' ')[0]}'s Agent`;
      const agentAvatarEl = document.getElementById('signal-agent-avatar-left');
      if (agentAvatarEl) {
        agentAvatarEl.src = config.avatarUrl || '/assets/images/signal-agent_clean.png';
        agentAvatarEl.style.visibility = '';
      }
      const agentSubEl = document.getElementById('signal-agent-left-sub');
      if (agentSubEl) agentSubEl.textContent = `Work History for ${name}`;
      const credsEl = document.getElementById('signal-agent-left-creds');
      if (credsEl) {
        const items = [];
        if (total) items.push(`${total} work sessions`);
        items.push('<a href="https://github.com/clearhythm" target="_blank" rel="noopener" class="signal-cred-link">2 repositories →</a>');
        const lastActive = (statusResult.status === 'fulfilled' && statusResult.value.lastUploadAt)
          ? (() => {
              const d = new Date(statusResult.value.lastUploadAt);
              const days = Math.round((Date.now() - d.getTime()) / 86400000);
              const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return days === 0 ? `today at ${time}` : days === 1 ? 'yesterday' : `${days} days ago`;
            })()
          : null;
        const introEl = document.getElementById('signal-agent-creds-intro');
        if (introEl) introEl.textContent = `My agent is designed to help you assess my fit for any project, collaboration, or role. It's trained on my living work history across:`;

        const contactEl = document.getElementById('signal-agent-contact');
        if (contactEl && config.contactLinks) {
          const { calendar, linkedin } = config.contactLinks;
          if (calendar) {
            contactEl.innerHTML = `<a href="${calendar}" target="_blank" rel="noopener" class="btn btn-outline signal-contact-btn">Book a call →</a>`;
          } else if (linkedin) {
            contactEl.innerHTML = `<a href="${linkedin}" target="_blank" rel="noopener" class="btn btn-outline signal-contact-btn">Connect on LinkedIn →</a>`;
          }
        }
        credsEl.innerHTML = items.map(t => `<li>${t}</li>`).join('');
        const updatedEl = document.getElementById('signal-agent-updated');
        if (updatedEl) updatedEl.textContent = lastActive ? `Last updated ${lastActive}` : '';
      }

      // Greeting as first chat bubble
      const greeting = `Hey! Ask me anything about my work, or paste a job description and I'll tell you how I'd fit.`;
      state.currentPersona = 'colleague';
      state.chatHistory.push({ role: 'assistant', content: greeting });
      appendMessage('assistant', greeting);

      // Enable input
      inputEl.disabled = false;
      sendBtnEl.disabled = false;
      inputEl.placeholder = 'Paste a JD or ask anything…';
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
          body: JSON.stringify({
            signalId: state.signalId,
            ...(state.evalContext ? { evalContext: state.evalContext } : {}),
          }),
        });
        const data = await res.json();
        if (modalTitleEl) {
          modalTitleEl.innerHTML = `Signal Interview <span class="signal-modal-owner-badge">owner</span>`;
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
        ...(state.currentEvalId ? { currentEvalId: state.currentEvalId } : {}),
      };
    },

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
  inputEl.disabled = true;
  sendBtnEl.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  agentIntroEl?.classList.remove('is-done');
  scoreInnerEl?.classList.remove('is-active');
  scorePanelEl?.classList.remove('is-compacted', 'is-expanded');
  if (scoreTabEl) { scoreTabEl.classList.remove('is-active'); }
  if (scoreTabBadge) scoreTabBadge.textContent = '';
  document.querySelector('[data-tab="profile"]')?.classList.add('is-active');

  // Reset modal header and score label
  if (modalTitleEl) {
    const badge = modeName === 'owner' ? ' <span class="signal-modal-owner-badge">owner</span>' : '';
    modalTitleEl.innerHTML = `Signal Interview${badge}`;
  }
  if (scoreLabelEl) scoreLabelEl.textContent = 'Fit Score';
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
    evalContext: options.evalContext || null,
    profileCompacted: false,
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

  // Compact profile panel on first message (mobile)
  if (!state.profileCompacted && window.innerWidth <= BREAKPOINT_MD) {
    scorePanelEl?.classList.add('is-compacted');
    state.profileCompacted = true;
  }

  showThinking();

  let assistantEl = null;
  let fullResponse = '';
  let evaluationRendered = false;
  let evaluationSavedThisTurn = false;

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
          if (event.tool === 'evaluate_fit') {
            evaluationRendered = true;
            evaluationSavedThisTurn = true;
            const { evalId, roleTitle, summary, strengths, gaps, score, recommendation } = event.result || {};
            if (evalId) state.currentEvalId = evalId;
            const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const strengthsHtml = (strengths || []).map(s => `<li class="eval-strength-item">${esc(s)}</li>`).join('');
            const gapsHtml = (gaps || []).map(g => `<li class="eval-gap-item">${esc(g)}</li>`).join('');
            const el = appendMessage('assistant', '');
            el.closest('.signal-message')?.classList.add('signal-message--eval');
            el.innerHTML = `
              <div class="eval-output">
                <h3 class="eval-output-role">${esc(roleTitle)}</h3>
                <p class="eval-output-summary">${esc(summary)}</p>
                ${strengthsHtml ? `<div class="eval-section"><h4 class="eval-section-heading">What Fits</h4><ul class="eval-items-list">${strengthsHtml}</ul></div>` : ''}
                ${gapsHtml ? `<div class="eval-section"><h4 class="eval-section-heading">Potential Gaps</h4><ul class="eval-items-list">${gapsHtml}</ul></div>` : ''}
              </div>`;
            messagesEl.scrollTop = messagesEl.scrollHeight;
            if (recommendation && recommendationEl) {
              const recLabels = {
                'strong-candidate': 'Strong Candidate.',
                'worth-applying': 'Worth Applying.',
                'stretch': 'Stretch Role.',
                'poor-fit': 'Poor Fit.',
              };
              recommendationEl.textContent = recLabels[recommendation] || '';
              recommendationEl.hidden = !recLabels[recommendation];
            }
            if (score) {
              updateScorePanel({ ...score, reason: null });
            }
          } else if (event.tool === 'update_fit_score') {
            // Visitor mode: incremental score updates (no eval card)
            const { skills, alignment, personality, confidence, reason } = event.result || {};
            updateScorePanel({ skills, alignment, personality, confidence, reason });
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
          // Conversational path (visitor mode only): no eval_fit tool was called this turn
          if (!evaluationSavedThisTurn) {
            if (!state.currentEvalId && state.lastScore && state.lastScore.confidence >= 0.5) {
              const { skills, alignment, personality, confidence } = state.lastScore;
              createEvalRecord({ scores: { skills, alignment, personality, confidence } });
            } else if (state.currentEvalId && state.lastScore) {
              const { skills, alignment, personality, confidence } = state.lastScore;
              upsertEvalScores({ skills, alignment, personality, confidence });
            }
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
