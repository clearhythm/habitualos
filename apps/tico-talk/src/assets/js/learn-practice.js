// The Menu drill's Practice experience — streaming chat, TICO:/GUEST:/
// ITEM:/FACT_TYPE:/RESULT: marker parsing, two-pass (Basics -> Complete)
// fact coverage, the pass-transition/Mastered banners, the flag-and-
// confirm correction flow, and per-section chat persistence. Owns its own
// DOM (#learn-transcript, the composer, the progress bar) inside
// #menu-practice.
//
// This module never imports menu-restaurant-filter.js (which owns
// browse/detail rendering) — the only way information flows back out is
// through the callbacks passed into startPractice, so the dependency
// stays one-directional: menu-restaurant-filter.js imports this file, not
// the other way around.
import { getOrCreateUserId } from './utils/user-id.js';
import { generateChatId } from './utils/data-utils.js';
import {
  loadFactCoverageCache,
  saveFactCoverageCache,
  hydrateSectionCoverage,
  markFactCovered,
  markLastTrained,
  passForSection,
  passProgress,
  isSectionMastered
} from './learn-coverage.js';
import { saveLearnChatBeacon, saveLearnChat } from './collections/learn-chats.js';
import { log } from './utils/log.js';

// ─── DOM ───────────────────────────────────────────────────────────────
const transcript = document.getElementById('learn-transcript');
const answerForm = document.getElementById('learn-answer-form');
const answerInput = document.getElementById('learn-answer-input');
const sendButton = document.getElementById('learn-send-btn');
const flagButton = document.getElementById('learn-flag-btn');
const progressBar = document.getElementById('learn-progress-bar');
const progressBarLabel = document.getElementById('learn-progress-bar-label');

// Direct scroll control on the page itself, not element.scrollIntoView()
// — the latter's per-element/per-render geometry guessing is what caused
// streaming to jump around and rehydrated history to stop short of the
// true bottom. This always lands exactly at the bottom, unconditionally,
// regardless of what changed. Whole-page scroll (not an internal
// container) is deliberate here — see .learn-drill's comment in
// _learn.scss for why.
function scrollTranscriptToBottom() {
  window.scrollTo(0, document.documentElement.scrollHeight);
}

// ─── Session state ───────────────────────────────────────────────────
// "Current" for this module means "whichever section Practice is open
// for" — tracked independently of menu-restaurant-filter.js's own
// currentRestaurantId/currentSection, set fresh by startPractice.
let practiceRestaurantId = null;
let practiceSection = null;
let practiceItemIds = [];
let practiceCallbacks = {};
let currentChatId = null;
let chatHistory = [];
let factCoverage = {};
let awaitingResponse = false;
let awaitingPassTransition = false; // guards sendTurn's finally from re-enabling input under the transition banner
let passTransitionShown = false; // guards the transition banner from firing twice per session
let masteredThisTurn = false;
let activeCorrectionCard = null;

// ─── Section chat persistence (localStorage) ────────────────────────────
// Every turn writes here — cheap, instant, local. Firestore is only
// touched at three boundaries (learned / exited / abandoned), not per
// turn. Keyed by restaurant + section together since two restaurants can
// share a category name.
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function lsKey(restaurantId, section) {
  return `tico-learn-chat-${restaurantId}-${section}`;
}

// Returns { chatId, history } for a fresh or rehydrated section, or null
// if there's nothing usable (caller should start a brand-new drill). A
// stale (TTL-expired) entry with real content gets flushed as
// 'abandoned' before being cleared.
function loadSectionState(restaurantId, section) {
  try {
    const raw = localStorage.getItem(lsKey(restaurantId, section));
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (Date.now() - state.timestamp > TTL_MS) {
      if (state.history?.some((m) => m.role === 'user')) {
        flushSectionChat(restaurantId, section, 'abandoned', { useBeacon: false, stateOverride: state });
      }
      localStorage.removeItem(lsKey(restaurantId, section));
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function saveSectionState(restaurantId, section, history, chatId) {
  try {
    localStorage.setItem(lsKey(restaurantId, section), JSON.stringify({ chatId, history, timestamp: Date.now() }));
  } catch {}
}

function clearSectionState(restaurantId, section) {
  try { localStorage.removeItem(lsKey(restaurantId, section)); } catch {}
}

// Single save path for all three boundaries. useBeacon: true for saves
// that coincide with navigating away ('exited'); false where the tab
// stays open ('learned', TTL-driven 'abandoned' flush on load).
function flushSectionChat(restaurantId, section, action, { useBeacon, stateOverride } = {}) {
  const state = stateOverride || { chatId: currentChatId, history: chatHistory };
  if (!state.history?.some((m) => m.role === 'user')) return; // nothing worth saving
  const payload = {
    chatId: state.chatId,
    userId: getOrCreateUserId(),
    restaurantId,
    section,
    messages: state.history,
    action,
    conversationStart: state.history[0]?.timestamp || null,
    conversationEnd: new Date().toISOString(),
  };
  if (useBeacon) {
    const queued = saveLearnChatBeacon(payload);
    if (!queued) saveLearnChat(payload).catch(() => {});
  } else {
    saveLearnChat(payload).catch(() => {});
  }
  clearSectionState(restaurantId, section);
}

/**
 * Pure check (with the TTL/abandoned-flush side effect loadSectionState
 * already had) — does a persisted session exist for this section? Used to
 * decide initial Review-vs-Practice mode on load/URL-restore, without
 * actually opening a session.
 */
export function hasActiveSession(restaurantId, section) {
  return loadSectionState(restaurantId, section) !== null;
}

// ─── Flag-and-confirm correction flow ────────────────────────────────────
// Tico refuses to state anything outside the menu data, but the menu is
// necessarily incomplete — this lets a trainee flag a real staff fact
// Tico is missing/wrong about. The last exchange is sent to an
// extraction call that proposes a clean, standalone note; the trainee
// confirms/edits/rejects it rather than retyping it from scratch (see
// docs/VISION.md's Data Principle — never fabricate, always confirm).
function removeCorrectionCard() {
  activeCorrectionCard?.remove();
  activeCorrectionCard = null;
}

async function proposeCorrection() {
  if (activeCorrectionCard) return; // already open
  const lastAssistant = [...chatHistory].reverse().find((m) => m.role === 'assistant');
  const lastUser = [...chatHistory].reverse().find((m) => m.role === 'user');
  if (!lastAssistant || !lastUser) return;

  flagButton.disabled = true;
  try {
    const response = await fetch('/api/learn-propose-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: practiceRestaurantId,
        lastUserMessage: lastUser.content,
        lastAssistantMessage: lastAssistant.content,
        currentSection: practiceSection
      })
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      renderCorrectionMessage(data.reason || data.error || 'Couldn’t find a clear correction in that exchange.');
      return;
    }
    renderCorrectionCard(data.text, data.scope, data.section);
  } catch {
    renderCorrectionMessage('Couldn’t reach Tico just now — try flagging again in a moment.');
  } finally {
    flagButton.disabled = false;
  }
}

function renderCorrectionMessage(message) {
  const card = document.createElement('div');
  card.className = 'correction-card';
  card.innerHTML = `<p class="correction-card__status"></p>`;
  card.querySelector('.correction-card__status').textContent = message;
  transcript.appendChild(card);
  scrollTranscriptToBottom();
  setTimeout(() => card.remove(), 4000);
}

function renderCorrectionCard(proposedText, scope, section) {
  const card = document.createElement('div');
  card.className = 'correction-card';
  card.innerHTML = `
    <p class="correction-card__label">Add this as a staff note?</p>
    <textarea class="correction-card__text"></textarea>
    <p class="correction-card__scope"></p>
    <div class="correction-card__actions">
      <button type="button" class="btn correction-card__confirm">Confirm</button>
      <button type="button" class="correction-card__reject">Discard</button>
    </div>
  `;
  const textEl = card.querySelector('.correction-card__text');
  const scopeEl = card.querySelector('.correction-card__scope');
  textEl.value = proposedText;
  scopeEl.textContent = scope === 'restaurant'
    ? 'Applies restaurant-wide.'
    : `Applies to ${section} only.`;

  card.querySelector('.correction-card__reject').addEventListener('click', removeCorrectionCard);
  card.querySelector('.correction-card__confirm').addEventListener('click', async () => {
    const text = textEl.value.trim();
    if (!text) return;
    try {
      await fetch('/api/learn-save-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: practiceRestaurantId, text, scope, section })
      });
      removeCorrectionCard();
      renderCorrectionMessage('Saved — Tico will use this going forward.');
    } catch {
      renderCorrectionMessage('Couldn’t save that just now — try again in a moment.');
    }
  });

  transcript.appendChild(card);
  activeCorrectionCard = card;
  scrollTranscriptToBottom();
}

flagButton?.addEventListener('click', proposeCorrection);

function updateSendButton() {
  sendButton.disabled = answerInput.value.trim().length === 0;
}

// Auto-resize textarea as the user types — reset to auto first so
// scrollHeight re-measures from a collapsed state, otherwise it only
// ever grows.
answerInput?.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
  updateSendButton();
});

// Desktop: Enter submits. Mobile (coarse pointer): Enter inserts a
// newline, matching native textarea behavior. Shift+Enter always inserts
// a newline on both.
answerInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      answerForm.requestSubmit();
    }
  }
});

function appendLine(speaker, text) {
  const line = document.createElement('p');
  line.className = `transcript-line transcript-line--${speaker}`;
  line.textContent = text;
  transcript.appendChild(line);
  scrollTranscriptToBottom();
}

function appendThinking() {
  const line = document.createElement('p');
  line.className = 'transcript-line transcript-line--tico learn-thinking';
  line.textContent = 'Tico’s thinking…';
  transcript.appendChild(line);
  scrollTranscriptToBottom();
  return line;
}

// ─── Speaker segments (TICO:/GUEST:/ITEM:/FACT_TYPE:/RESULT: line markers) ─
// The model's raw text is tagged with markers at the start of each line
// (see learn-chat-init.cjs's system prompt). TICO:/GUEST: are Tico's own
// voice / the guest's dialogue — rendered as bubbles. ITEM:/FACT_TYPE:/
// RESULT: are hidden tracking markers (never rendered) reporting which
// item/fact-type/result the trainee's last answer covered — accumulated
// silently and reported via onFactResult once a full triplet closes.
// Markers are parsed out here and never shown; chatHistory still stores
// the raw marked-up text verbatim, since the model conditions on its own
// past formatting to keep producing it reliably.
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST|ITEM|FACT_TYPE|RESULT):[ \t]?/;
const SEGMENT_MARKER_HOLDBACK = 10; // length of "FACT_TYPE:" — longest marker

function createSegmentElement(speaker) {
  const el = document.createElement('p');
  el.className = speaker === 'tico' ? 'transcript-line transcript-line--tico' : 'transcript-line transcript-line--guest';
  transcript.appendChild(el);
  return el;
}

// Renders one complete (non-streaming) assistant turn — used to rehydrate
// a persisted chat, where the full raw text is already available.
function renderAssistantTurn(rawText) {
  const re = new RegExp(SEGMENT_MARKER_RE, 'g');
  const positions = [];
  let m;
  while ((m = re.exec(rawText))) {
    positions.push({ start: m.index, contentStart: m.index + m[0].length, marker: m[1] });
  }
  if (positions.length === 0) {
    // No markers (older stored data, or the model skipped the format) — fall back to one guest bubble.
    if (rawText.trim()) createSegmentElement('guest').textContent = rawText.trim();
    return;
  }
  positions.forEach((pos, i) => {
    if (pos.marker !== 'TICO' && pos.marker !== 'GUEST') return; // hidden tracking markers, never rendered
    const end = i + 1 < positions.length ? positions[i + 1].start : rawText.length;
    const text = rawText.slice(pos.contentStart, end).trim();
    if (text) createSegmentElement(pos.marker === 'TICO' ? 'tico' : 'guest').textContent = text;
  });
}

// Streaming variant of the same parsing — call createStreamRenderer() once
// per turn, then feed it the full accumulated text after every token.
// onFactResult(itemId, factType, result) fires once per resolved
// ITEM:/FACT_TYPE:/RESULT: triplet.
function createStreamRenderer(onFactResult) {
  let consumedLen = 0;
  let marker = null;
  let bubble = null;
  let buffer = '';
  let pendingItemId = null;
  let pendingFactType = null;

  function closeSegment() {
    if (marker === 'ITEM') {
      pendingItemId = buffer.trim();
    } else if (marker === 'FACT_TYPE') {
      pendingFactType = buffer.trim();
    } else if (marker === 'RESULT') {
      const result = buffer.trim();
      if (pendingItemId && pendingFactType && result) onFactResult?.(pendingItemId, pendingFactType, result);
      pendingItemId = null;
      pendingFactType = null;
    }
    buffer = '';
  }

  function openSegment(nextMarker) {
    marker = nextMarker;
    bubble = (marker === 'TICO' || marker === 'GUEST')
      ? createSegmentElement(marker === 'TICO' ? 'tico' : 'guest')
      : null;
  }

  function absorb(chunk) {
    if (!chunk) return;
    if (!bubble && marker === null) {
      // Safe fallback if the model ever forgets the opening marker entirely.
      marker = 'GUEST';
      bubble = createSegmentElement('guest');
    }
    if (bubble) {
      bubble.appendChild(document.createTextNode(chunk));
      scrollTranscriptToBottom();
    } else {
      buffer += chunk;
    }
  }

  return {
    update(fullTextSoFar) {
      for (;;) {
        const unconsumed = fullTextSoFar.slice(consumedLen);
        const m = SEGMENT_MARKER_RE.exec(unconsumed);
        if (m && m.index === 0) {
          closeSegment();
          openSegment(m[1]);
          consumedLen += m[0].length;
          continue;
        }
        if (m && m.index > 0) {
          absorb(unconsumed.slice(0, m.index));
          consumedLen += m.index;
          continue;
        }
        // No marker in the unconsumed tail — hold back a few characters in
        // case they're the start of one still arriving token by token.
        if (unconsumed.length > SEGMENT_MARKER_HOLDBACK) {
          const safeLen = unconsumed.length - SEGMENT_MARKER_HOLDBACK;
          absorb(unconsumed.slice(0, safeLen));
          consumedLen += safeLen;
        }
        break;
      }
    },
    finalize(fullText) {
      absorb(fullText.slice(consumedLen));
      consumedLen = fullText.length;
      closeSegment();
    }
  };
}

// ─── Fact coverage ────────────────────────────────────────────────────
// Updates the progress bar and notifies the caller (menu-restaurant-
// filter.js) of the current pass + coverage, so it can re-highlight the
// Review panel and refresh the browse-list pill/Train link.
function syncCoverageUI() {
  const pass = passForSection(practiceItemIds, factCoverage);
  const { done, total } = passProgress(practiceItemIds, factCoverage, pass);
  if (progressBar) progressBar.style.setProperty('--progress', total ? `${(done / total) * 100}%` : '0%');
  if (progressBarLabel) {
    progressBarLabel.textContent = pass === 'basics' ? `Basics: ${done} of ${total}` : `Complete: ${done} of ${total}`;
  }
  practiceCallbacks.onCoverageChanged?.(pass, factCoverage);
}

function showPassTransition() {
  awaitingPassTransition = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const banner = document.createElement('div');
  banner.className = 'learn-pass-transition';
  banner.innerHTML = `
    <p class="learn-pass-transition__label">You’ve got the basics down for ${practiceSection}. Let’s go deeper on dietary and pricing.</p>
    <button type="button" class="btn" data-action="continue">Continue</button>
  `;
  transcript.appendChild(banner);
  scrollTranscriptToBottom();
  banner.querySelector('[data-action="continue"]').addEventListener('click', () => {
    awaitingPassTransition = false;
    answerInput.disabled = false;
    updateSendButton();
    practiceCallbacks.onTransitionToReview?.();
  }, { once: true });
}

function showMasteredBanner() {
  const banner = document.createElement('div');
  banner.className = 'learn-learned-banner';
  banner.textContent = `You’ve mastered ${practiceSection}!`;
  transcript.appendChild(banner);
  scrollTranscriptToBottom();
}

// Called once per resolved ITEM:/FACT_TYPE:/RESULT: triplet, mid-stream.
function handleFactResult(itemId, factType, result) {
  if (!practiceItemIds.includes(itemId)) return;
  if (!['ingredients', 'dietary', 'pricing'].includes(factType)) return;
  if (factCoverage[itemId]?.[factType]) return; // already covered, monotonic
  if (result !== 'correct') return;

  const passBefore = passForSection(practiceItemIds, factCoverage);
  factCoverage = { ...factCoverage, [itemId]: { ...factCoverage[itemId], [factType]: true } };
  saveFactCoverageCache(practiceRestaurantId, practiceSection, factCoverage);
  markFactCovered(getOrCreateUserId(), practiceRestaurantId, practiceSection, itemId, factType);
  syncCoverageUI();

  const passAfter = passForSection(practiceItemIds, factCoverage);
  if (passBefore === 'basics' && passAfter === 'complete' && !passTransitionShown) {
    passTransitionShown = true;
    showPassTransition();
    return;
  }
  if (passAfter === 'complete' && isSectionMastered(practiceItemIds, factCoverage)) {
    masteredThisTurn = true;
  }
}

// ─── Streaming turns ──────────────────────────────────────────────────
async function sendTurn(message) {
  awaitingResponse = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const thinkingLine = appendThinking();
  const renderer = createStreamRenderer(handleFactResult);
  let fullText = '';
  masteredThisTurn = false;

  try {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'learn',
        userId: getOrCreateUserId(),
        message,
        chatHistory,
        restaurantId: practiceRestaurantId,
        section: practiceSection,
        factCoverage
      })
    });

    thinkingLine.remove();

    if (!response.ok || !response.body) {
      appendLine('tico', 'Couldn’t reach Tico just now — try again in a moment.');
      return;
    }

    const reader = response.body.getReader();
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
        const evt = JSON.parse(line.slice(6));

        if (evt.type === 'token') {
          fullText += evt.text;
          renderer.update(fullText);
        } else if (evt.type === 'done') {
          renderer.finalize(fullText);
        } else if (evt.type === 'error') {
          renderer.finalize(fullText);
          appendLine('tico', evt.error || 'Something went wrong.');
        }
      }
    }

    chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    chatHistory.push({ role: 'assistant', content: fullText, timestamp: new Date().toISOString() });
    saveSectionState(practiceRestaurantId, practiceSection, chatHistory, currentChatId);
    if (flagButton) flagButton.hidden = false;

    if (masteredThisTurn) {
      showMasteredBanner();
      flushSectionChat(practiceRestaurantId, practiceSection, 'learned', { useBeacon: false });
    }
  } finally {
    awaitingResponse = false;
    // Stays disabled under the pass-transition banner until its own
    // Continue handler re-enables it — otherwise this would immediately
    // undo that disable the moment the stream finishes.
    if (!awaitingPassTransition) {
      answerInput.disabled = false;
      updateSendButton();
      answerInput.focus();
    }
  }
}

answerForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (awaitingResponse) return;
  const message = answerInput.value.trim();
  if (!message) return;
  appendLine('user', message);
  answerInput.value = '';
  answerInput.style.height = 'auto';
  updateSendButton();
  sendTurn(message);
});

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Flushes the currently open session (if any) as 'exited', against
 * whichever restaurant/section it actually belongs to (tracked
 * internally — correct even if the caller's own "current restaurant" has
 * since changed), and resets in-memory/DOM state. Safe to call with no
 * session open (no-op flush, harmless DOM reset).
 */
export function exitPractice() {
  if (currentChatId) {
    flushSectionChat(practiceRestaurantId, practiceSection, 'exited', { useBeacon: false });
  }
  currentChatId = null;
  chatHistory = [];
  activeCorrectionCard = null;
  if (flagButton) flagButton.hidden = true;
  if (transcript) transcript.innerHTML = '';
}

/**
 * Enters (or resumes) Practice for one section. Idempotent: calling this
 * again for the exact restaurant+section that's already open just
 * re-syncs the UI via the callbacks rather than restarting the
 * conversation — callers don't need their own "is this already open"
 * guard (see menu-restaurant-filter.js's setMode).
 *
 * callbacks:
 *   onSessionStarted()               — fires once, only for a genuinely
 *                                       new session (lastTrained bookkeeping)
 *   onCoverageChanged(pass, coverage) — fires on hydration + every fact
 *                                       result (review highlight, pill,
 *                                       Train link)
 *   onTransitionToReview()            — Continue on the pass-transition banner
 */
export function startPractice(restaurantId, section, sectionItemIds, callbacks = {}) {
  if (currentChatId && practiceRestaurantId === restaurantId && practiceSection === section) {
    practiceCallbacks = callbacks;
    syncCoverageUI();
    return;
  }

  practiceRestaurantId = restaurantId;
  practiceSection = section;
  practiceItemIds = sectionItemIds;
  practiceCallbacks = callbacks;
  passTransitionShown = false;
  awaitingPassTransition = false;

  markLastTrained(getOrCreateUserId(), restaurantId, section);
  callbacks.onSessionStarted?.();

  // localStorage here is a CACHE of Firestore, not an independent store —
  // Firestore is the actual source of truth. Paint instantly from the
  // cache, then reconcile once hydrateSectionCoverage resolves.
  factCoverage = loadFactCoverageCache(restaurantId, section);
  syncCoverageUI();
  hydrateSectionCoverage(getOrCreateUserId(), restaurantId, section).then((reconciled) => {
    factCoverage = reconciled;
    syncCoverageUI();
  });

  const existing = loadSectionState(restaurantId, section);
  transcript.innerHTML = '';
  if (existing) {
    currentChatId = existing.chatId;
    chatHistory = existing.history;
    chatHistory.forEach((m) => {
      if (m.role === 'user') {
        appendLine('user', m.content);
      } else {
        renderAssistantTurn(m.content);
      }
    });
    answerForm.hidden = false;
    if (flagButton) flagButton.hidden = false;
    // renderAssistantTurn doesn't scroll on its own — one explicit call
    // here after the whole history is rendered guarantees landing at the
    // true bottom regardless of which role the last message happens to be.
    scrollTranscriptToBottom();
  } else {
    currentChatId = generateChatId();
    chatHistory = [];
    answerForm.hidden = false;
    sendTurn('Let’s get started.');
  }
}
