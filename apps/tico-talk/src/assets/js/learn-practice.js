// The Menu drill's Practice experience — streaming chat, TICO:/GUEST:
// marker parsing, the record_fact_result tool call, two-pass (Basics ->
// Complete) fact coverage, the pass-transition/Covered banners, the
// flag-and-confirm correction flow, and per-section chat persistence.
// Owns its own DOM (#learn-transcript, the composer, the progress bar)
// inside #menu-practice.
//
// Each turn is stateless from the model's point of view — chatHistory is
// never sent to the model at all (see sendTurn), it exists purely as a
// local display/persistence log. The app owns coverage, pass/coverage
// state, and when to even invoke the model for a new turn — but not which
// open item gets asked about next. That's the model's free choice every
// turn (given the open-items list, see learn-chat-init.cjs), reported
// back through the record_fact_result tool call and tracked here as
// currentTarget, so the following turn's evaluation prompt knows what the
// trainee's answer is actually about.
//
// Re-entering a Covered section always starts a fresh "review session"
// (isReviewSession) instead of resuming the original finished drill — any
// fact type is fair game, mixed together, tracked against its own
// ephemeral reviewCoverage rather than the real one, and never written to
// Firestore/the local coverage cache. Real Covered status can't be
// touched by how a review session goes.
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
  markSectionProgress,
  passForSection,
  passStatusLabel
} from './learn-coverage.js';
import { saveLearnChatBeacon, saveLearnChat } from './collections/learn-chats.js';
import { log } from './utils/log.js';
import { scrollToBottom, appendLine, appendThinking } from './utils/chat-transcript.js';
import { initAutoResizeTextarea, initEnterToSubmit, updateSendButtonState } from './utils/chat-composer.js';
import { loadSessionCache, saveSessionCache, clearSessionCache } from './utils/chat-session-cache.js';
import { createGettingStartedElement, createReviewStartedElement, renderAssistantTurn, createStreamRenderer } from './learn-markers.js';

// ─── DOM ───────────────────────────────────────────────────────────────
const transcript = document.getElementById('learn-transcript');
const answerForm = document.getElementById('learn-answer-form');
const answerInput = document.getElementById('learn-answer-input');
const sendButton = document.getElementById('learn-send-btn');
const flagButton = document.getElementById('learn-flag-btn');

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
let currentTarget = null; // {itemId, factType} the model is currently being asked to evaluate — its own free pick, reported back via record_fact_result; null before the model has picked anything yet
let isReviewSession = false; // re-entering an already-Covered (or Mastered) section — fresh chat, ungated "review" pass, never touches the real per-item facts (see startPractice)
let reviewCoverage = {}; // session-only coverage for review sessions, separate from the real factCoverage; reset every time a review session starts, never saved
let justMasteredThisSession = false; // set true the moment factCoverage._progress gets upgraded to 'Mastered' this turn, so the completion banner reads "You Mastered this!" instead of "Still got it down!"
let awaitingResponse = false;
let awaitingContinue = false; // guards sendTurn's finally from re-enabling input under the pass-transition or Covered banner
let passTransitionShown = false; // guards the transition banner from firing twice per session
let coveredThisTurn = false;
let passTransitionThisTurn = false; // set mid-stream by handleFactResult, shown only after the turn's own evaluation text has rendered
let activeCorrectionCard = null;

// ─── Section chat persistence (localStorage) ────────────────────────────
// LS is the primary read/write surface — every turn writes here, and it's
// trusted indefinitely, never expired/cleared client-side. Firestore is a
// rare, deliberate write (not a continuous sync): only at real boundaries
// (leaving a section, covering it) or when a status threshold is
// crossed (see appendStatusMarker below) — see saveLearnChat below.
// Keyed by restaurant + section together since two restaurants can share
// a category name.
function lsKey(restaurantId, section) {
  return `tico-learn-chat-${restaurantId}-${section}`;
}

// Returns { chatId, history, target } for a rehydrated section, or null
// if there's nothing saved yet (caller should start a brand-new drill).
// target is persisted alongside the rest — it's the model's own pick
// from earlier, not something re-derivable from factCoverage alone, so a
// reload needs it restored, not recomputed.
function loadSectionState(restaurantId, section) {
  return loadSessionCache(lsKey(restaurantId, section));
}

function saveSectionState(restaurantId, section, history, chatId, target) {
  saveSessionCache(lsKey(restaurantId, section), { chatId, history, target });
}

// Testing/support utility — clears this section's local chat cache (the
// other half of a full section reset, alongside clearFactCoverageCache
// in learn-coverage.js and the Firestore-side reset). Exported since the
// stats/reset page isn't itself an active Practice session and has no
// other way to reach this module's private lsKey.
export function clearChatState(restaurantId, section) {
  clearSessionCache(lsKey(restaurantId, section));
}

// The rare Firestore write — 'exited' (leaving the section), 'covered'
// (Covered), or 'milestone' (a status threshold crossed mid-session, see
// appendStatusMarker). Never clears LS — LS stays the ongoing source of
// truth for display regardless of what's been flushed to Firestore.
// useBeacon: true for saves that coincide with navigating away ('exited').
function flushSectionChat(restaurantId, section, action, { useBeacon } = {}) {
  if (!chatHistory.some((m) => m.role === 'user')) return; // nothing worth saving yet
  const payload = {
    chatId: currentChatId,
    userId: getOrCreateUserId(),
    restaurantId,
    section,
    messages: chatHistory,
    action,
    conversationStart: chatHistory[0]?.timestamp || null,
    conversationEnd: new Date().toISOString(),
  };
  if (useBeacon) {
    const queued = saveLearnChatBeacon(payload);
    if (!queued) saveLearnChat(payload).catch(() => {});
  } else {
    saveLearnChat(payload).catch(() => {});
  }
}

/**
 * Does a persisted session exist for this section? Used to decide initial
 * Review-vs-Practice mode on load/URL-restore, without opening a session.
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
  scrollToBottom();
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
  scrollToBottom();
}

flagButton?.addEventListener('click', proposeCorrection);

function updateSendButton() {
  updateSendButtonState(answerInput, sendButton);
}

initAutoResizeTextarea(answerInput, updateSendButton);
initEnterToSubmit(answerInput, answerForm);

// Sent as the trainee's "first message" to open every fresh drill — the
// Anthropic API requires a user turn to start a conversation on, but the
// trainee never actually typed this, so it's never rendered as a real
// bubble (see createGettingStartedElement in learn-markers.js / the
// rehydration loop below).
const KICKOFF_MESSAGE = 'Let’s get started.';

// ─── Fact coverage ────────────────────────────────────────────────────
// Notifies the caller (menu-restaurant-filter.js) of the current pass +
// coverage, so it can re-highlight the Review panel and refresh the
// browse-list pill/Train link. The status itself (Training/Warming Up/
// Getting Hot) isn't shown here as a persistent indicator — see
// appendStatusMarker below, it's an in-line transcript marker instead.
function syncCoverageUI() {
  const pass = passForSection(practiceItemIds, factCoverage);
  practiceCallbacks.onCoverageChanged?.(pass, factCoverage);
}

// Inserts a lightweight "You are: {label}" title line into the
// transcript, in place — not a chat bubble, a status marker sharing the
// same timeline. Persisted as a synthetic STATUS: entry in chatHistory
// (parsed by the same pipeline as real turns, see renderAssistantTurn)
// so it survives a reload and replays in the right position, not just a
// live-only visual flourish. flush: true also forces the rare Firestore
// write immediately — writes happen when the user crosses a real
// threshold (a status level-up), not on every turn and not only at
// session boundaries (Erik's call).
function appendStatusMarker(label, { flush = false } = {}) {
  const content = `STATUS: ${label}`;
  renderAssistantTurn(content);
  scrollToBottom();
  chatHistory.push({ role: 'assistant', content, timestamp: new Date().toISOString() });
  saveSectionState(practiceRestaurantId, practiceSection, chatHistory, currentChatId, currentTarget);
  if (flush) flushSectionChat(practiceRestaurantId, practiceSection, 'milestone', { useBeacon: false });
}

function showPassTransition() {
  awaitingContinue = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  // Basics is genuinely done at this point (chatHistory already has this
  // turn's final exchange) — save it now, not lazily, so it's not still
  // sitting only in LS by the time Continue clears it for the next pass.
  flushSectionChat(practiceRestaurantId, practiceSection, 'milestone', { useBeacon: false });
  const banner = document.createElement('div');
  banner.className = 'learn-pass-transition';
  banner.innerHTML = `
    <p class="learn-pass-transition__label">You’ve got the basics down for ${practiceSection}. Let’s go deeper on dietary and pricing.</p>
    <button type="button" class="btn" data-action="continue">Continue</button>
  `;
  transcript.appendChild(banner);
  scrollToBottom();
  banner.querySelector('[data-action="continue"]').addEventListener('click', () => {
    awaitingContinue = false;
    answerInput.disabled = false;
    updateSendButton();
    // Basics and Complete are separate chat passes — already flushed above,
    // so clear it here rather than resuming it when Practice reopens.
    currentChatId = null;
    chatHistory = [];
    clearChatState(practiceRestaurantId, practiceSection);
    practiceCallbacks.onTransitionToReview?.();
  }, { once: true });
}

function showCoveredBanner() {
  awaitingContinue = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const banner = document.createElement('div');
  banner.className = 'learn-covered-banner';
  // Three distinct cases: a genuine first-time full coverage (not a
  // review session at all), a review session that just newly earned real
  // Mastered status (was Covered-but-not-Mastered coming in), or a review
  // session re-confirming Mastery it already had.
  const label = justMasteredThisSession
    ? `You Mastered ${practiceSection}!`
    : isReviewSession
    ? `Still got ${practiceSection} down!`
    : `You’ve covered ${practiceSection}!`;
  banner.innerHTML = `
    <p class="learn-covered-banner__label">${label}</p>
    <button type="button" class="btn" data-action="continue">Continue</button>
  `;
  transcript.appendChild(banner);
  scrollToBottom();
  // Where Continue goes next is menu-restaurant-filter.js's call (it owns
  // the same "earliest non-covered section, else loop back to the first"
  // logic the browse list's Train link already uses) — this module only
  // ever asks for it via the callback, never computes it itself. If it
  // loops back to this exact section (everything's covered), a review
  // session needs to start genuinely fresh, not idempotently resume this
  // just-finished one — clear state the same way the pass-transition
  // banner does, rather than relying on the (rare) isNewSection check in
  // menu-restaurant-filter.js's enterDetail to catch it.
  banner.querySelector('[data-action="continue"]').addEventListener('click', () => {
    awaitingContinue = false;
    currentChatId = null;
    chatHistory = [];
    practiceCallbacks.onCoveredContinue?.();
  }, { once: true });
}

// Called once per record_fact_result tool call, mid-stream.
// result/next/stop come straight off the tool call — result is the
// model's judgment on currentTarget (absent on the kickoff turn, nothing
// to evaluate yet), next is the model's own freely-chosen pick for what
// it's about to ask, and stop is the app's call (computed server-side in
// learn-tool-execute.cjs from real coverage — a pass boundary or full
// coverage always overrides whatever the model proposed as next).
function handleFactResult(result, next, stop) {
  if (result && currentTarget) {
    // Review sessions track their own ephemeral coverage, always the
    // 'review' pass (never derived) — never the real factCoverage, and
    // never persisted (no cache save, no Firestore write).
    const passBefore = isReviewSession ? 'review' : passForSection(practiceItemIds, factCoverage);
    const coverageBefore = isReviewSession ? reviewCoverage : factCoverage;
    const statusBefore = passStatusLabel(practiceItemIds, coverageBefore, passBefore);

    if (result === 'correct') {
      if (isReviewSession) {
        reviewCoverage = { ...reviewCoverage, [currentTarget.itemId]: { ...reviewCoverage[currentTarget.itemId], [currentTarget.factType]: true } };
      } else {
        factCoverage = { ...factCoverage, [currentTarget.itemId]: { ...factCoverage[currentTarget.itemId], [currentTarget.factType]: true } };
        saveFactCoverageCache(practiceRestaurantId, practiceSection, factCoverage);
        markFactCovered(getOrCreateUserId(), practiceRestaurantId, practiceSection, currentTarget.itemId, currentTarget.factType);
      }
      syncCoverageUI();
    }

    // Always the pass this fact actually belonged to (passBefore), never
    // whatever pass comes next — right at a boundary/coverage-completion
    // moment this is exactly 100% of that pass, a real fourth rung
    // ("Getting Hot") that belongs right before the transition/covered
    // banner, not a marker to suppress.
    const coverageAfter = isReviewSession ? reviewCoverage : factCoverage;
    const statusAfter = passStatusLabel(practiceItemIds, coverageAfter, passBefore);
    if (statusAfter !== statusBefore) {
      appendStatusMarker(statusAfter, { flush: true });
    }
  }

  if (stop === 'passComplete' && !passTransitionShown) {
    passTransitionShown = true;
    // Deferred: this fires mid-stream, before this turn's own TICO:
    // evaluation has even rendered yet. Flag it and let sendTurn show the
    // banner once the full turn is on screen.
    passTransitionThisTurn = true;
    currentTarget = null;
    return;
  }
  if (stop === 'covered') {
    if (isReviewSession) {
      // A review session finishing successfully is what actually earns
      // real Mastered status — but only the first time; if this section
      // was already Mastered coming in, finishing another review pass
      // just reconfirms it, no new write.
      if (factCoverage._progress !== 'Mastered') {
        justMasteredThisSession = true;
        factCoverage = { ...factCoverage, _progress: 'Mastered' };
        markSectionProgress(getOrCreateUserId(), practiceRestaurantId, practiceSection, 'Mastered');
        syncCoverageUI();
      }
    } else {
      // First time reaching full coverage for this section — the actual
      // "Covered" moment. Only ever reached on the non-review path, which
      // only runs for sections that aren't Covered yet, so no guard needed.
      factCoverage = { ...factCoverage, _progress: 'Covered' };
      markSectionProgress(getOrCreateUserId(), practiceRestaurantId, practiceSection, 'Covered');
      syncCoverageUI();
    }
    coveredThisTurn = true;
    currentTarget = null;
    return;
  }
  if (next) {
    currentTarget = { itemId: next.itemId, factType: next.factType };
  }
}

// ─── Streaming turns ──────────────────────────────────────────────────
// Stateless per turn — chatHistory is never sent to the model (see the
// chatHistory: [] below). currentTarget (sent as `target`) carries the one
// thing the model actually needs remembered across turns: what it's
// currently being asked to evaluate. chatHistory here is purely a local
// display/persistence log now (rehydration, the Firestore audit trail,
// the flag-and-confirm correction flow).
async function sendTurn(message, { isKickoff = false } = {}) {
  awaitingResponse = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const thinkingLine = appendThinking(transcript, 'Tico’s thinking…');
  const renderer = createStreamRenderer();
  let fullText = '';
  let turnStopped = false; // set once record_fact_result reports a pass boundary or full coverage — anything after that is a wasted follow-up generation, never shown
  coveredThisTurn = false;
  passTransitionThisTurn = false;

  try {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'learn',
        userId: getOrCreateUserId(),
        message,
        chatHistory: [],
        restaurantId: practiceRestaurantId,
        section: practiceSection,
        factCoverage: isReviewSession ? reviewCoverage : factCoverage,
        isKickoff,
        target: currentTarget,
        reviewMode: isReviewSession
      })
    });

    thinkingLine.remove();

    if (!response.ok || !response.body) {
      appendLine(transcript, 'tico', 'Couldn’t reach Tico just now — try again in a moment.');
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
          if (turnStopped) continue;
          fullText += evt.text;
          renderer.update(fullText);
        } else if (evt.type === 'tool_complete' && evt.tool === 'record_fact_result') {
          const { result, next, stop } = evt.result || {};
          handleFactResult(result, next, stop);
          if (passTransitionThisTurn || coveredThisTurn) {
            turnStopped = true;
            // Nothing legitimate follows — flush now rather than waiting
            // for 'done' (which only arrives after a wasted follow-up
            // generation). This also matters beyond latency: the renderer
            // holds back the last few characters of fullText in case
            // they're the start of a marker, and finalize() is the only
            // thing that flushes that tail — skip it and the turn's own
            // last word or so silently never renders.
            renderer.finalize(fullText);
          } else if (fullText) {
            // Whatever text follows is a fresh Claude generation (post tool
            // round-trip), not a literal continuation of the line that was
            // just streaming — force the break rather than counting on the
            // model to add one on its own. Only when there's already an
            // open segment to land inside, though (fullText non-empty) —
            // on a kickoff turn the tool call fires before any text at
            // all, so this '\n' would otherwise be the very first content
            // with no marker yet, tripping the renderer's no-marker
            // fallback into opening a spurious empty bubble for it.
            fullText += '\n';
          }
        } else if (evt.type === 'done') {
          if (!turnStopped) renderer.finalize(fullText);
        } else if (evt.type === 'error') {
          renderer.finalize(fullText);
          appendLine(transcript, 'tico', evt.error || 'Something went wrong.');
        }
      }
    }

    chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    chatHistory.push({ role: 'assistant', content: fullText, timestamp: new Date().toISOString() });
    saveSectionState(practiceRestaurantId, practiceSection, chatHistory, currentChatId, currentTarget);
    if (flagButton) flagButton.hidden = false;

    if (passTransitionThisTurn) {
      showPassTransition();
    } else if (coveredThisTurn) {
      showCoveredBanner();
      flushSectionChat(practiceRestaurantId, practiceSection, 'covered', { useBeacon: false });
    }
  } finally {
    awaitingResponse = false;
    // Stays disabled under the pass-transition banner until its own
    // Continue handler re-enables it — otherwise this would immediately
    // undo that disable the moment the stream finishes.
    if (!awaitingContinue) {
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
  appendLine(transcript, 'user', message);
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
  currentTarget = null;
  isReviewSession = false;
  reviewCoverage = {};
  justMasteredThisSession = false;
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
 *                                       Train link). coverage carries the
 *                                       section's _progress field too.
 *   onTransitionToReview()            — Continue on the pass-transition banner
 *   onCoveredContinue()              — Continue on the Covered banner, once
 *                                       the section is fully done
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
  awaitingContinue = false;
  justMasteredThisSession = false;

  // localStorage here is a CACHE of Firestore, not an independent store —
  // Firestore is the actual source of truth. Paint instantly from the
  // cache, then reconcile once hydrateSectionCoverage resolves.
  factCoverage = loadFactCoverageCache(restaurantId, section);
  syncCoverageUI();
  hydrateSectionCoverage(getOrCreateUserId(), restaurantId, section).then((reconciled) => {
    factCoverage = reconciled;
    // A review session tracks its own coverage — a late reconcile
    // shouldn't re-sync the UI against the real (fully-covered)
    // factCoverage mid-review, that would look like a regression.
    if (!isReviewSession) syncCoverageUI();
  });

  // Covered or Mastered both mean "re-entering this is a review," not a
  // fresh drill — read straight off the section's own stored _progress,
  // no per-item derivation.
  isReviewSession = factCoverage._progress === 'Covered' || factCoverage._progress === 'Mastered';
  transcript.innerHTML = '';

  if (isReviewSession) {
    // Always genuinely fresh — never resume the original, already-
    // finished drill (see Erik's ask: re-entering a Covered section
    // shouldn't just replay the old "you're done" conversation). Ephemeral
    // coverage only; nothing here ever touches Firestore/the local cache.
    reviewCoverage = {};
    currentChatId = generateChatId();
    chatHistory = [];
    currentTarget = null;
    answerForm.hidden = false;
    if (flagButton) flagButton.hidden = false;
    createReviewStartedElement();
    appendStatusMarker(passStatusLabel(practiceItemIds, reviewCoverage, 'review'));
    sendTurn(KICKOFF_MESSAGE, { isKickoff: true });
    return;
  }

  markLastTrained(getOrCreateUserId(), restaurantId, section);
  // Only ever reached for a section that isn't Covered/Mastered yet (see
  // isReviewSession above), so this is always a safe, unconditional
  // "at least Training" — never a downgrade.
  if (factCoverage._progress !== 'Training') {
    factCoverage = { ...factCoverage, _progress: 'Training' };
    markSectionProgress(getOrCreateUserId(), restaurantId, section, 'Training');
  }
  callbacks.onSessionStarted?.();

  const existing = loadSectionState(restaurantId, section);
  if (existing) {
    currentChatId = existing.chatId;
    chatHistory = existing.history;
    currentTarget = existing.target || null;
    chatHistory.forEach((m, i) => {
      if (m.role === 'user') {
        // The very first turn's "kickoff" user message is a technical
        // necessity (the API requires a user turn to open on), never
        // something the trainee actually said — render the Getting
        // Started marker in its place instead of a fake bubble. Checked
        // by position + exact content, not just role, so a real reply
        // that happens to also say this later in conversation isn't
        // mistaken for it.
        if (i === 0 && m.content === KICKOFF_MESSAGE) {
          createGettingStartedElement();
        } else {
          appendLine(transcript, 'user', m.content);
        }
      } else {
        renderAssistantTurn(m.content);
      }
    });
    answerForm.hidden = false;
    if (flagButton) flagButton.hidden = false;
    // renderAssistantTurn doesn't scroll on its own — one explicit call
    // here after the whole history is rendered guarantees landing at the
    // true bottom regardless of which role the last message happens to be.
    scrollToBottom();
  } else {
    currentChatId = generateChatId();
    chatHistory = [];
    currentTarget = null; // nothing evaluated yet — the model picks its own first question, reported back via the kickoff turn's tool call
    answerForm.hidden = false;
    createGettingStartedElement();
    // No threshold has been crossed yet — this is the starting state, not
    // a level-up, so no forced Firestore write (flush defaults to false).
    appendStatusMarker(passStatusLabel(practiceItemIds, factCoverage, passForSection(practiceItemIds, factCoverage)));
    sendTurn(KICKOFF_MESSAGE, { isKickoff: true });
  }
}
