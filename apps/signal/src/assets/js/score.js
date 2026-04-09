// ─── Score page JS (/score/) ───────────────────────────────────────────────────

import { apiUrl } from './api.js';

const GUEST_ID_KEY = 'signal_guest_id';
const GUEST_EVALS_KEY = 'signal_guest_evals';
const GUEST_EVAL_LIMIT = 3;

function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function getSavedEvals() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_EVALS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEval(evalData) {
  const evals = getSavedEvals();
  evals.unshift(evalData); // newest first
  localStorage.setItem(GUEST_EVALS_KEY, JSON.stringify(evals.slice(0, GUEST_EVAL_LIMIT)));
}

function updateSavedEval(gevalId, patch) {
  const evals = getSavedEvals();
  const idx = evals.findIndex(e => e.gevalId === gevalId);
  if (idx !== -1) {
    evals[idx] = { ...evals[idx], ...patch };
    localStorage.setItem(GUEST_EVALS_KEY, JSON.stringify(evals));
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function recLabel(rec) {
  const map = {
    'strong-candidate': 'Strong candidate',
    'worth-applying': 'Worth applying',
    'stretch': 'Stretch',
    'poor-fit': 'Poor fit',
  };
  return map[rec] || rec;
}

function recPillClass(rec) {
  if (rec === 'strong-candidate') return 'score-rec-pill--strong';
  if (rec === 'worth-applying') return 'score-rec-pill--worth';
  if (rec === 'stretch') return 'score-rec-pill--stretch';
  return 'score-rec-pill--poor';
}

function renderGapsHtml(gaps) {
  if (!gaps || gaps.length === 0) return '<p class="score-summary" style="color:rgba(255,255,255,0.35);font-style:italic">No significant gaps identified.</p>';
  return gaps.map(g => `
    <div class="score-gap-item score-gap-item--${g.severity || 'low'}">
      <span class="score-gap-severity score-gap-severity--${g.severity || 'low'}">${g.severity || 'low'}</span>
      <p class="score-gap-text">${g.gap}</p>
      ${g.framing ? `<p class="score-gap-framing">${g.framing}</p>` : ''}
    </div>
  `).join('');
}

function renderStrengthsHtml(strengths) {
  if (!strengths || strengths.length === 0) return '';
  return `<ul class="score-list">${strengths.map(s => `<li class="score-list-item">${s}</li>`).join('')}</ul>`;
}

function renderCard(data) {
  const score = data.score || {};
  const overall = score.overall ?? 0;
  const skills = score.skills ?? 0;
  const alignment = score.alignment ?? 0;
  const rec = data.recommendation || '';
  const title = data.jdTitle || 'Role';

  return `
    <div class="score-card-header">
      <div>
        <p class="score-role-title">${escapeHtml(title)}</p>
        <span class="score-rec-pill ${recPillClass(rec)}">${recLabel(rec)}</span>
      </div>
      <div class="score-overall-badge">
        <span class="score-overall-num">${overall}</span>
        <span class="score-overall-label">/ 10</span>
      </div>
    </div>

    <div class="score-dims">
      <div class="score-dim">
        <div class="score-dim-label">Skills</div>
        <div class="score-dim-bar-wrap"><div class="score-dim-bar" style="width:${skills * 10}%"></div></div>
        <div class="score-dim-val">${skills}<span style="font-size:0.75rem;color:rgba(255,255,255,0.35);font-weight:400"> / 10</span></div>
      </div>
      <div class="score-dim">
        <div class="score-dim-label">Alignment</div>
        <div class="score-dim-bar-wrap"><div class="score-dim-bar" style="width:${alignment * 10}%"></div></div>
        <div class="score-dim-val">${alignment}<span style="font-size:0.75rem;color:rgba(255,255,255,0.35);font-weight:400"> / 10</span></div>
      </div>
    </div>

    ${data.summary ? `
    <div class="score-section">
      <p class="score-section-title">SUMMARY</p>
      <p class="score-summary">${escapeHtml(data.summary)}</p>
    </div>` : ''}

    ${data.strengths && data.strengths.length ? `
    <div class="score-section">
      <p class="score-section-title">STRENGTHS</p>
      ${renderStrengthsHtml(data.strengths)}
    </div>` : ''}

    ${data.gaps && data.gaps.length ? `
    <div class="score-section">
      <p class="score-section-title">GAPS</p>
      <div style="display:flex;flex-direction:column;gap:0.5rem">${renderGapsHtml(data.gaps)}</div>
    </div>` : ''}

    ${data.personalityNote ? `
    <div class="score-section">
      <p class="score-section-title">CAREER SIGNAL</p>
      <p class="score-personality">${escapeHtml(data.personalityNote)}</p>
    </div>` : ''}
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── History strip ─────────────────────────────────────────────────────────────

function renderHistory(evals, activeIndex = 0) {
  const historyEl = document.getElementById('score-history');
  if (!historyEl || evals.length === 0) return;

  historyEl.innerHTML = evals.map((e, i) => `
    <button class="score-history-btn ${i === activeIndex ? 'is-active' : ''}" data-idx="${i}">
      ${escapeHtml(e.jdTitle || 'Role')}
    </button>
  `).join('');
  historyEl.hidden = false;

  historyEl.querySelectorAll('.score-history-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      renderHistory(evals, idx);
      showResult(evals[idx], evals.length);
    });
  });
}

// ─── Show result (state 3) ────────────────────────────────────────────────────

function showResult(data, evalCount) {
  const mainEl = document.getElementById('score-main');
  const resultEl = document.getElementById('score-result');
  const cardEl = document.getElementById('score-card');
  const againBtn = document.getElementById('score-again-btn');
  const coachBtn = document.getElementById('score-coach-btn');
  const upsellEl = document.getElementById('score-upsell');
  const formEl = document.getElementById('score-form');
  const limitEl = document.getElementById('score-limit');

  // Ensure we're showing the main wrap
  mainEl.hidden = false;
  document.getElementById('score-coach').hidden = true;
  document.getElementById('score-building').hidden = true;
  document.getElementById('score-improved-wrap').hidden = true;

  cardEl.innerHTML = renderCard(data);
  resultEl.classList.remove('hidden');

  if (evalCount >= GUEST_EVAL_LIMIT) {
    formEl.hidden = true;
    limitEl.hidden = false;
    againBtn.hidden = true;
  } else {
    formEl.hidden = false;
    limitEl.hidden = true;
    againBtn.hidden = false;
  }

  // Show coach button only when closeable gaps exist and not already improved
  const hasCloseableGaps = (data.gaps || []).some(g => g.closeable === true);
  const alreadyImproved = !!data.improvedScore;
  coachBtn.hidden = !(hasCloseableGaps && !alreadyImproved);

  // Wire coach button to this specific eval
  coachBtn.onclick = () => startCoachChat(data);

  upsellEl.hidden = false;

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Submit ────────────────────────────────────────────────────────────────────

async function handleSubmit() {
  const resumeEl = document.getElementById('score-resume');
  const jdEl = document.getElementById('score-jd');
  const submitBtn = document.getElementById('score-submit-btn');
  const progressEl = document.getElementById('score-progress');
  const errorEl = document.getElementById('score-error');

  const resumeText = resumeEl.value.trim();
  const jdText = jdEl.value.trim();

  errorEl.style.display = 'none';

  if (!resumeText) {
    errorEl.textContent = 'Please paste your resume.';
    errorEl.style.display = 'block';
    resumeEl.focus();
    return;
  }
  if (!jdText) {
    errorEl.textContent = 'Please paste a job description.';
    errorEl.style.display = 'block';
    jdEl.focus();
    return;
  }

  submitBtn.disabled = true;
  progressEl.style.display = 'block';
  progressEl.textContent = 'Analyzing your fit… this takes about 20 seconds.';

  const guestId = getGuestId();

  try {
    const res = await fetch(apiUrl('/api/signal-guest-score'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, resumeText, jdText }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 429 && data.error === 'limit_reached') {
        showLimitState();
        return;
      }
      errorEl.textContent = data.error || 'Something went wrong. Please try again.';
      errorEl.style.display = 'block';
      return;
    }

    const evalEntry = {
      gevalId: data.gevalId,
      jdTitle: data.jdTitle || 'Role',
      score: data.score,
      recommendation: data.recommendation,
      summary: data.summary,
      strengths: data.strengths,
      gaps: data.gaps,
      personalityNote: data.personalityNote,
      jdSummary: data.jdSummary,
    };

    saveEval(evalEntry);
    const evals = getSavedEvals();
    renderHistory(evals, 0);
    showResult(evals[0], evals.length);

    updateUpsellCtas(guestId);

  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    progressEl.style.display = 'none';
  }
}

function showLimitState() {
  const formEl = document.getElementById('score-form');
  const limitEl = document.getElementById('score-limit');
  formEl.hidden = true;
  limitEl.hidden = false;
  const historyEl = document.getElementById('score-history');
  if (historyEl) historyEl.hidden = false;
  updateUpsellCtas(getGuestId());
}

function updateUpsellCtas(guestId) {
  const url = `/register/?guestId=${encodeURIComponent(guestId)}`;
  document.querySelectorAll('#score-upsell-cta, #score-limit-cta, #score-improved-cta').forEach(el => {
    el.href = url;
  });
}

// ─── SSE stream parser (copied from signal-widget.js) ─────────────────────────

async function readStream(res, handlers) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }
      switch (event.type) {
        case 'token':
          handlers.onToken?.(event.text);
          break;
        case 'tool_start':
          handlers.onToolStart?.(event.tool);
          break;
        case 'tool_complete':
          handlers.onToolComplete?.(event.tool, event.result);
          break;
        case 'done':
          handlers.onDone?.(event.fullResponse);
          break;
        case 'error':
          handlers.onError?.(event.message || 'Stream error');
          break;
      }
    }
  }
}

// ─── Coach chat (state 4) ─────────────────────────────────────────────────────

let coachChatHistory = [];
let coachGevalId = null;
let coachSending = false;

function appendMsg(role, text) {
  const messagesEl = document.getElementById('score-coach-messages');
  const div = document.createElement('div');
  div.className = `msg msg--${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function startCoachChat(evalData) {
  coachChatHistory = [];
  coachGevalId = evalData.gevalId;
  coachSending = false;

  const messagesEl = document.getElementById('score-coach-messages');
  messagesEl.innerHTML = '';

  // Show coach state, hide others
  document.getElementById('score-main').hidden = true;
  document.getElementById('score-building').hidden = true;
  document.getElementById('score-improved-wrap').hidden = true;
  document.getElementById('score-coach').hidden = false;

  // Render opener without API call
  const opener = "I've looked at your resume against the role. I'm going to ask you a few targeted questions — answer as specifically as you can. Let's start.";
  appendMsg('assistant', opener);

  document.getElementById('score-coach-input').focus();
}

async function sendChatMessage() {
  if (coachSending) return;
  const inputEl = document.getElementById('score-coach-input');
  const sendBtn = document.getElementById('score-coach-send');
  const userMessage = inputEl.value.trim();
  if (!userMessage) return;

  coachSending = true;
  inputEl.value = '';
  inputEl.disabled = true;
  sendBtn.disabled = true;

  appendMsg('user', userMessage);

  const assistantDiv = appendMsg('assistant', '');
  let assistantText = '';

  try {
    const guestId = getGuestId();
    const res = await fetch(apiUrl('/api/signal-chat-stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'signal-guest-coach',
        userId: guestId,
        gevalId: coachGevalId,
        message: userMessage,
        chatHistory: coachChatHistory,
      }),
    });

    if (!res.ok) {
      assistantDiv.textContent = 'Something went wrong. Please try again.';
      return;
    }

    await readStream(res, {
      onToken(text) {
        assistantText += text;
        assistantDiv.textContent = assistantText;
        document.getElementById('score-coach-messages').scrollTop = document.getElementById('score-coach-messages').scrollHeight;
      },
      onToolStart(tool) {
        if (tool === 'finish_interview') {
          // Transition to building screen immediately
          document.getElementById('score-coach').hidden = true;
          document.getElementById('score-building').hidden = false;
        }
      },
      onToolComplete(tool, result) {
        if (tool === 'finish_interview') {
          handleImprove(coachGevalId);
        }
      },
      onDone(fullResponse) {
        if (assistantText) {
          coachChatHistory.push({ role: 'user', content: userMessage });
          coachChatHistory.push({ role: 'assistant', content: assistantText });
        }
      },
      onError(msg) {
        assistantDiv.textContent = `Error: ${msg}`;
      },
    });
  } catch (err) {
    assistantDiv.textContent = 'Network error. Please try again.';
  } finally {
    coachSending = false;
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ─── Improve (state 5 → 6) ────────────────────────────────────────────────────

async function handleImprove(gevalId) {
  const guestId = getGuestId();
  try {
    // Fire background function (returns 202 immediately)
    await fetch(apiUrl('/api/signal-guest-improve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, gevalId }),
    });

    // Poll status until done (max ~90s, every 4s)
    const MAX_POLLS = 22;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await fetch(apiUrl('/api/signal-guest-improve-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, gevalId }),
      });
      const status = await statusRes.json();
      if (status.done) {
        renderImproved(gevalId, status);
        return;
      }
    }
    throw new Error('Timed out waiting for improvement');
  } catch (err) {
    console.error('[handleImprove]', err);
    document.getElementById('score-building').hidden = true;
    document.getElementById('score-main').hidden = false;
  }
}

function renderImproved(gevalId, result) {
  const evals = getSavedEvals();
  const evalData = evals.find(e => e.gevalId === gevalId) || {};
  const originalOverall = evalData.score?.overall ?? 0;
  const improvedOverall = result.improvedScore?.overall ?? 0;

  // Update localStorage entry
  updateSavedEval(gevalId, {
    improvedScore: result.improvedScore,
    rewrittenSections: result.rewrittenSections,
  });

  // Render delta badge
  const deltaBadgeEl = document.getElementById('score-delta-badge');
  deltaBadgeEl.innerHTML = `<span class="score-delta-before">${originalOverall}</span><span class="score-delta-arrow">→</span><span class="score-delta-after">${improvedOverall}</span>`;

  // Render rewrite cards
  const cardsEl = document.getElementById('score-rewrite-cards');
  const noImproveEl = document.getElementById('score-no-improve-msg');

  if (!result.improved) {
    noImproveEl.hidden = false;
    noImproveEl.textContent = result.reason || 'The rewrite didn\'t improve the score. More specific examples would help.';
    cardsEl.innerHTML = '';
  } else {
    noImproveEl.hidden = true;
    const sections = result.rewrittenSections || [];
    cardsEl.innerHTML = sections.map(s => `
      <div class="score-rewrite-card">
        ${s.note ? `<p class="score-rewrite-note">${escapeHtml(s.note)}</p>` : ''}
        <div class="score-rewrite-cols">
          <div class="score-rewrite-col">
            <p class="score-rewrite-col-label">BEFORE</p>
            <p class="score-rewrite-col-text">${escapeHtml(s.original || '')}</p>
          </div>
          <div class="score-rewrite-col score-rewrite-col--after">
            <p class="score-rewrite-col-label">AFTER</p>
            <p class="score-rewrite-col-text">${escapeHtml(s.rewritten || '')}</p>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Show improved state
  document.getElementById('score-building').hidden = true;
  document.getElementById('score-improved-wrap').hidden = false;
  document.getElementById('score-improved-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });

  updateUpsellCtas(getGuestId());
}

// ─── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const guestId = getGuestId();
  const evals = getSavedEvals();

  updateUpsellCtas(guestId);

  // If most recent eval has improvements, show improved state directly
  if (evals.length > 0 && evals[0].improvedScore) {
    renderImproved(evals[0].gevalId, {
      improved: (evals[0].improvedScore?.overall ?? 0) > (evals[0].score?.overall ?? 0),
      improvedScore: evals[0].improvedScore,
      rewrittenSections: evals[0].rewrittenSections || [],
    });
  } else if (evals.length > 0) {
    renderHistory(evals, 0);
    showResult(evals[0], evals.length);
  } else if (evals.length >= GUEST_EVAL_LIMIT) {
    showLimitState();
  }

  document.getElementById('score-submit-btn').addEventListener('click', handleSubmit);

  document.getElementById('score-again-btn').addEventListener('click', () => {
    const resultEl = document.getElementById('score-result');
    const formEl = document.getElementById('score-form');
    resultEl.classList.add('hidden');
    formEl.hidden = false;
    document.getElementById('score-jd').value = '';
    document.getElementById('score-resume').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Coach chat events
  document.getElementById('score-coach-send').addEventListener('click', sendChatMessage);
  document.getElementById('score-coach-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  document.getElementById('score-coach-back').addEventListener('click', () => {
    document.getElementById('score-coach').hidden = true;
    document.getElementById('score-main').hidden = false;
  });
});
