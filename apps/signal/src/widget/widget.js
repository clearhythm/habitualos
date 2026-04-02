// widget.js — orchestrator: open/close/transition/sendMessage

import { state, resetChatState } from './core/state.js';
import { injectHTML, bindEls } from './core/dom.js';
import { appendMessage, showThinking, removeThinking, loadMarked, renderMarkdown } from './core/messages.js';
import { resetScorePanel, updateScore } from './core/score.js';
import { readStream } from './core/stream.js';
import { createEvalRecord, upsertEvalScores } from './core/eval.js';
import { saveChatLS, persistChat, beaconChat } from './core/history.js';

import * as visitorMode  from './modes/visitor.js';
import * as ownerMode    from './modes/owner.js';
import * as onboardMode  from './modes/onboard.js';

const MODES = {
  visitor: visitorMode,
  owner:   ownerMode,
  onboard: onboardMode,
};

let els = null;
let activeMode = null;

// ─── Transition ────────────────────────────────────────────────────────────────

export async function transition(modeName, options = {}) {
  const newSignalId = options.signalId || state.signalId || null;

  // No-op if same mode + same signalId (continue existing session)
  if (activeMode && state.activeMode === modeName && state.signalId === newSignalId) return;

  resetChatState();
  state.activeMode = modeName;
  state.signalId = newSignalId;
  state.evalContext = options.evalContext || null;

  // Reset UI
  els.messages.innerHTML = '';
  resetScorePanel(els);
  els.personaBtns.innerHTML = '';
  els.personaWrap.hidden = true;
  els.input.disabled = true;
  els.sendBtn.disabled = true;
  els.input.value = '';
  els.input.style.height = 'auto';
  els.profilePanel?.classList.remove('is-done');

  // Reset header title
  if (els.title) els.title.innerHTML = 'Signal Interview';

  els.input.placeholder =
    modeName === 'owner'
      ? 'Paste a job description to score your fit…'
      : 'Tell me about your AI work…';

  activeMode = MODES[modeName];
  if (!activeMode) { console.error('[signal] Unknown mode:', modeName); return; }

  await activeMode.init(state, els, state.baseUrl);
}

// ─── Send message ──────────────────────────────────────────────────────────────

export async function sendMessage(text) {
  if (state.isStreaming || !text.trim() || !activeMode) return;

  // Let the active mode handle commands first (owner /signin etc.)
  if (activeMode.handleCommand) {
    const consumed = await activeMode.handleCommand(text, state, els, state.baseUrl);
    if (consumed) return;
  }

  state.isStreaming = true;
  els.input.disabled = true;
  els.sendBtn.disabled = true;

  state.turnCount++;
  state.chatHistory.push({ role: 'user', content: text });
  appendMessage(els, 'user', text);

  showThinking(els);

  let fullResponse = '';
  let evaluationRendered = false;
  let evaluationSavedThisTurn = false;
  let assistantContentEl = null;

  try {
    const payload = activeMode.buildPayload(state, text);
    const res = await fetch(`${state.baseUrl}/api/signal-chat-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await readStream(res, {
      onToken(tokenText) {
        fullResponse += tokenText;
        // Buffer silently — render on done to avoid raw markdown flash
      },

      onToolComplete(tool, result) {
        if (tool === 'evaluate_fit') {
          evaluationRendered = true;
          evaluationSavedThisTurn = true;
          const { evalId, roleTitle, summary, strengths, gaps, score, recommendation } = result || {};
          if (evalId) state.currentEvalId = evalId;

          const esc = (s) =>
            (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const strengthsHtml = (strengths || [])
            .map((s) => `<li class="eval-strength-item">${esc(s)}</li>`)
            .join('');
          const gapsHtml = (gaps || [])
            .map((g) => `<li class="eval-gap-item">${esc(g)}</li>`)
            .join('');

          const msgContentEl = appendMessage(els, 'assistant', '');
          msgContentEl.closest('.msg')?.classList.add('msg--eval');
          msgContentEl.innerHTML = `
            <div class="eval-output">
              <p class="eval-role">${esc(roleTitle)}</p>
              <p class="eval-summary">${esc(summary)}</p>
              ${strengthsHtml ? `<div class="eval-section"><h4>What Fits</h4><ul class="eval-items">${strengthsHtml}</ul></div>` : ''}
              ${gapsHtml ? `<div class="eval-section"><h4>Potential Gaps</h4><ul class="eval-items eval-items--gaps">${gapsHtml}</ul></div>` : ''}
            </div>`;
          els.messages.scrollTop = els.messages.scrollHeight;

          if (recommendation && els.recommendation) {
            const recLabels = {
              'strong-candidate': 'Strong Candidate.',
              'worth-applying':   'Worth Applying.',
              'stretch':          'Stretch Role.',
              'poor-fit':         'Poor Fit.',
            };
            const label = recLabels[recommendation];
            if (label) {
              els.recommendation.textContent = label;
              els.recommendation.hidden = false;
            }
          }

          if (score) updateScore(els, state, { ...score, reason: null });

        } else if (tool === 'update_fit_score') {
          const { skills, alignment, personality, confidence, reason } = result || {};
          updateScore(els, state, { skills, alignment, personality, confidence, reason });
          if (state.currentEvalId) {
            upsertEvalScores(state, { skills, alignment, personality, confidence });
          }
        }
      },

      onDone(serverFullResponse) {
        fullResponse = serverFullResponse || fullResponse;
        removeThinking();

        if (!evaluationRendered && fullResponse.trim()) {
          assistantContentEl = appendMessage(els, 'assistant', '');
          assistantContentEl.innerHTML = renderMarkdown(fullResponse);
          els.messages.scrollTop = els.messages.scrollHeight;
        }

        state.chatHistory.push({ role: 'assistant', content: fullResponse });

        // Eval persistence: conversational path (no evaluate_fit tool this turn)
        if (!evaluationSavedThisTurn && state.lastScore) {
          const { skills, alignment, personality, confidence } = state.lastScore;
          if (!state.currentEvalId && confidence >= 0.5) {
            createEvalRecord(state, { scores: { skills, alignment, personality, confidence } });
          } else if (state.currentEvalId) {
            upsertEvalScores(state, { skills, alignment, personality, confidence });
          }
        }
      },

      onError(msg) {
        removeThinking();
        appendMessage(els, 'assistant', 'Something went wrong. Please try again.');
        console.error('[signal] Stream error:', msg);
      },
    });

    // Persist: localStorage every turn, DB every 3 turns
    saveChatLS(state);
    if (state.turnCount % 3 === 0) await persistChat(state, state.baseUrl);

  } catch (err) {
    removeThinking();
    if (assistantContentEl) assistantContentEl.closest('.msg')?.remove();
    else if (fullResponse.trim()) {
      const el = appendMessage(els, 'assistant', '');
      el.innerHTML = renderMarkdown(fullResponse);
    }
    appendMessage(els, 'assistant', 'Connection error. Please try again.');
    console.error('[signal] Stream fetch error:', err);
  }

  state.isStreaming = false;
  els.input.disabled = false;
  els.sendBtn.disabled = false;
  els.input.focus();
}

// ─── Open / close / toggle ─────────────────────────────────────────────────────

export function launch(options = {}) {
  if (!els) return;
  els.root.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  if (options.fullPage) els.root.classList.add('is-fullpage');

  const modeName = options.mode || (state.signalId ? 'visitor' : 'onboard');
  transition(modeName, options);
}

export function close() {
  if (!els) return;
  els.root.setAttribute('hidden', '');
  els.root.classList.remove('is-fullpage');
  document.body.style.overflow = '';
  if (state.chatHistory.length) persistChat(state, state.baseUrl);
}

export function toggle(options = {}) {
  if (!els) return;
  if (els.root.hasAttribute('hidden')) launch(options);
  else close();
}

// ─── Init (called on DOMContentLoaded) ────────────────────────────────────────

export function init() {
  // Inject Poppins for external sites that don't load it
  if (!document.querySelector('link[href*="Poppins"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  injectHTML(state.baseUrl);
  els = bindEls();
  loadMarked();

  // Close button
  els.closeBtn.addEventListener('click', close);

  // Best-effort save on page unload / tab hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.chatHistory.length) {
      beaconChat(state, state.baseUrl);
    }
  });
  window.addEventListener('beforeunload', () => {
    if (state.chatHistory.length) beaconChat(state, state.baseUrl);
  });

  // Textarea auto-resize
  els.input.addEventListener('input', () => {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 160) + 'px';
  });

  // Keyboard submit
  els.input.addEventListener('keydown', (e) => {
    const isMobile = window.innerWidth < 600;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      const text = els.input.value.trim();
      if (text) {
        els.input.value = '';
        els.input.style.height = 'auto';
        sendMessage(text);
      }
    }
  });

  // Form submit
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (text) {
      els.input.value = '';
      els.input.style.height = 'auto';
      sendMessage(text);
    }
  });
}
