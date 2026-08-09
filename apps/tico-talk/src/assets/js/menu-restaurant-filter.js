// Page script for /menu/ (also reused, restaurant-filtering only, by
// /menu-review/). /menu/ has two phases: browse (the reference list) and
// detail (one category, reached by clicking it or via Train). Detail has
// two modes, Review and Practice, toggled in place without changing
// phase — Review shows the category's items, Practice is the text chat.
// Switching Review <-> Practice never resets the chat: the transcript DOM
// and in-memory history just stay alive underneath, exactly like they
// would if Practice were its own permanent tab, so leaving and coming
// back mid-conversation (within the same category) picks up where it
// left off. There used to be a separate /learn/ page with its own picker
// phase, then a teach/drill split with "I'm Ready"/"Back to X" verbs;
// both are gone in favor of this Review/Practice framing.
//
// Every restaurant's content and every category's detail block are baked
// into the page at build time (same pattern as before) and shown/hidden
// here — no live fetch path duplicating a source of truth that already
// exists. The chat transcript itself is inherently dynamic and lives in
// one shared shell (#menu-practice) rather than being duplicated per
// category.
//
// URL scheme: /menu/food/, /menu/drinks/ (browse) and
// /menu/food/{category}, /menu/drinks/{category} (detail) are real
// routes — silently rewritten to this same file by netlify.toml (status
// 200, wildcarded on the category segment). The Review/Practice toggle
// has no URL of its own; both modes live at the same category URL (not a
// bookmarkable/deep-linkable distinction, unlike browse vs. detail).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId, applyRestaurantFilter } from './restaurant.js';
import { getLearnedSections, markSectionLearnedLocally } from './learned-sections.js';
import { saveLearnChatBeacon, saveLearnChat } from './collections/learn-chats.js';

const CONTENT_TYPE_KEY = 'tico-current-content-type';

// Single source of truth for the content-type <-> URL mapping — every
// other place that needs one direction or the other reads from this
// instead of re-deriving it.
const CONTENT_TYPE_PATHS = { food: '/menu/food/', drink: '/menu/drinks/' };

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function pathForContentType(type) {
  return CONTENT_TYPE_PATHS[type] || CONTENT_TYPE_PATHS.food;
}

function pathForTeach(type, sectionName) {
  return `${pathForContentType(type)}${slugify(sectionName)}`;
}

// Splits a pathname into { contentType, categorySlug }. categorySlug is
// null for a bare /menu/food/ visit (browse); both are null for
// anything outside the /menu/food|drinks/ namespace (e.g. bare /menu/).
function parsePath(pathname) {
  for (const [type, base] of Object.entries(CONTENT_TYPE_PATHS)) {
    // base carries its own trailing slash (e.g. '/menu/drinks/'), but a
    // bare visit to '/menu/drinks' (no trailing slash — what a typed URL
    // or an external link is likely to produce) is exactly as valid and
    // must resolve the same way, so the trailing slash can't be required
    // on both sides of the comparison.
    const baseNoSlash = base.replace(/\/$/, '');
    if (pathname === baseNoSlash || pathname.startsWith(base)) {
      const rest = pathname.slice(baseNoSlash.length).replace(/^\/+|\/+$/g, '');
      return { contentType: type, categorySlug: rest || null };
    }
  }
  return { contentType: null, categorySlug: null };
}

// A direct visit (or browser back/forward — see the popstate listener
// below) to /menu/food/... or /menu/drinks/... shows that type
// regardless of what's in localStorage from a previous session; bare
// /menu/ falls back to localStorage (defaulting to food) since the URL
// alone doesn't say which type it should be.
function getCurrentContentType() {
  const { contentType } = parsePath(location.pathname);
  if (contentType) return contentType;
  try {
    return localStorage.getItem(CONTENT_TYPE_KEY) || 'food';
  } catch {
    return 'food';
  }
}

function setCurrentContentType(type) {
  try { localStorage.setItem(CONTENT_TYPE_KEY, type); } catch {}
}

// Finds the exact (unslugified) category name a URL's category segment
// refers to, scoped to the current restaurant + content type — detail
// blocks are matched everywhere else by exact name (data-section,
// getLearnedSections), so this resolves the slug back to that instead of
// introducing a second, stored slug<->name mapping.
function findSectionBySlug(restaurantId, contentType, slug) {
  const match = Array.from(document.querySelectorAll('.menu-detail')).find(
    (el) => el.dataset.restaurant === restaurantId && el.dataset.contentType === contentType && slugify(el.dataset.section) === slug
  );
  return match?.dataset.section || null;
}

function applyContentTypeFilter(contentType) {
  // Scoped to .menu-content-panel and .train-icon specifically — the
  // toggle's own option buttons also carry a data-content-type attribute
  // (to identify which is which on click), and a bare [data-content-type]
  // selector here would match and hide those too.
  document.querySelectorAll('.menu-content-panel[data-content-type], .train-icon[data-content-type]').forEach((el) => {
    el.hidden = el.dataset.contentType !== contentType;
  });
  document.querySelectorAll('.page-title-switcher').forEach((wrapper) => {
    const label = contentType === 'drink' ? 'Drinks' : 'Food';
    const trigger = wrapper.querySelector('.page-title-switcher__label');
    if (trigger) trigger.textContent = label;
    wrapper.querySelectorAll('.content-type-switcher__option').forEach((opt) => {
      opt.classList.toggle('is-current', opt.dataset.contentType === contentType);
    });
  });
}

function updateTrainLink(restaurantId, contentType) {
  const venue = document.querySelector(`.menu-review__venue[data-restaurant="${restaurantId}"]`);
  const trainLink = venue?.querySelector('[data-train-link]');
  if (!trainLink) return;

  const panel = venue.querySelector(`.menu-content-panel[data-content-type="${contentType}"]`);
  const categoryNames = Array.from(panel?.querySelectorAll('.menu-category__name') || []).map((el) => el.textContent.trim());
  if (!categoryNames.length) return;

  const learned = getLearnedSections(restaurantId);
  const target = categoryNames.find((name) => !learned[name]) || categoryNames[0];
  trainLink.href = pathForTeach(contentType, target);
  trainLink.dataset.targetSection = target;
}

// ─── Phase/mode state ─────────────────────────────────────────────────
const browseEl = document.getElementById('menu-browse');
const detailEl = document.getElementById('menu-detail');
const practiceEl = document.getElementById('menu-practice');
const transcript = document.getElementById('learn-transcript');

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
const answerForm = document.getElementById('learn-answer-form');
const answerInput = document.getElementById('learn-answer-input');
const sendButton = document.getElementById('learn-send-btn');
const flagButton = document.getElementById('learn-flag-btn');

let currentRestaurantId = null;
let currentContentType = 'food';
let currentSection = null; // category name — only meaningful in detail
let currentPhase = 'browse'; // 'browse' | 'detail'
let currentMode = 'review'; // 'review' | 'practice' — only meaningful in detail
let currentChatId = null;
let chatHistory = [];
let awaitingResponse = false;

function showPhase(phase) {
  currentPhase = phase;
  if (browseEl) browseEl.hidden = phase !== 'browse';
  if (detailEl) detailEl.hidden = phase !== 'detail';
}

// Applies the review/practice mode to whichever category block is
// currently visible — scoped with :not([hidden]) rather than a stored
// reference, since the visible block already unambiguously identifies
// itself the same way restaurant/content-type filtering does elsewhere.
function applyMode(mode) {
  currentMode = mode;
  const active = document.querySelector('.menu-detail:not([hidden])');
  active?.querySelectorAll('.menu-detail__review').forEach((el) => { el.hidden = mode !== 'review'; });
  active?.querySelectorAll('.menu-detail__mode-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
  });
  if (practiceEl) practiceEl.hidden = mode !== 'practice';
}

// Only (re)starts the chat if one isn't already running for this
// section — toggling back to Practice after a Review detour must resume
// the same conversation, not restart it (see module comment).
function setMode(mode) {
  applyMode(mode);
  if (mode === 'practice' && !currentChatId) startDrill();
}

function enterBrowse(contentType, { pushUrl = true } = {}) {
  currentContentType = contentType;
  currentSection = null;
  setCurrentContentType(contentType);
  applyContentTypeFilter(contentType);
  if (currentRestaurantId) updateTrainLink(currentRestaurantId, contentType);
  // applyMode (called from enterDetail) is what normally shows/hides
  // #menu-practice — leaving detail phase entirely bypasses that, so its
  // visibility (and the composer inside it) has to be reset explicitly
  // here or it just carries over from whatever mode was last active.
  if (practiceEl) practiceEl.hidden = true;
  showPhase('browse');
  if (pushUrl) {
    const path = pathForContentType(contentType);
    if (location.pathname !== path) history.pushState(null, '', path);
  }
}

function enterDetail(contentType, sectionName, mode = 'review', { pushUrl = true } = {}) {
  const isNewSection = currentPhase !== 'detail' || currentSection !== sectionName;
  if (isNewSection && currentChatId) {
    flushSectionChat(currentRestaurantId, currentSection, 'exited', { useBeacon: false });
  }
  currentContentType = contentType;
  currentSection = sectionName;
  setCurrentContentType(contentType);
  if (isNewSection) {
    currentChatId = null;
    chatHistory = [];
    activeCorrectionCard = null;
    if (flagButton) flagButton.hidden = true;
    if (transcript) transcript.innerHTML = '';
  }
  document.querySelectorAll('.menu-detail').forEach((el) => {
    el.hidden = !(el.dataset.restaurant === currentRestaurantId && el.dataset.contentType === contentType && el.dataset.section === sectionName);
  });
  showPhase('detail');
  setMode(mode);
  if (pushUrl) history.pushState(null, '', pathForTeach(contentType, sectionName));
}

// Shared by the breadcrumb link and the restaurant switcher — both leave
// detail for browse of a (possibly different) content type. If that
// means abandoning an in-progress practice session, flush it first so
// the chat isn't silently dropped.
function switchToBrowse(contentType) {
  if (currentPhase === 'detail' && currentChatId) {
    flushSectionChat(currentRestaurantId, currentSection, 'exited', { useBeacon: false });
  }
  if (currentPhase !== 'browse') {
    currentChatId = null;
    chatHistory = [];
    activeCorrectionCard = null;
    if (flagButton) flagButton.hidden = true;
    if (transcript) transcript.innerHTML = '';
  }
  enterBrowse(contentType);
}

// ─── Section chat persistence (localStorage) ────────────────────────────
// Every turn writes here — cheap, instant, local. Firestore is only
// touched at three boundaries (learned / exited / abandoned), not per
// turn. Keyed by restaurant + section together since two restaurants can
// share a category name.
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function lsKey(restaurantId, section) {
  return `tico-learn-chat-${restaurantId}-${section}`;
}

function generateChatId() {
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

// ─── Flag-and-confirm correction flow ────────────────────────────────────
// Tico refuses to state anything outside the menu data, but the menu is
// necessarily incomplete — this lets a trainee flag a real staff fact
// Tico is missing/wrong about. The last exchange is sent to an
// extraction call that proposes a clean, standalone note; the trainee
// confirms/edits/rejects it rather than retyping it from scratch (see
// docs/VISION.md's Data Principle — never fabricate, always confirm).
let activeCorrectionCard = null;

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
        restaurantId: currentRestaurantId,
        lastUserMessage: lastUser.content,
        lastAssistantMessage: lastAssistant.content,
        currentSection
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
        body: JSON.stringify({ restaurantId: currentRestaurantId, text, scope, section })
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

// ─── Speaker segments (TICO:/GUEST: line markers) ───────────────────────
// The model's raw text is tagged with TICO:/GUEST: markers at the start
// of each line (see learn-chat-init.cjs's system prompt) so Tico's own
// voice (narration/evaluation — centered italic, no bubble) renders
// separately from the guest's spoken dialogue (a normal chat bubble).
// Markers are parsed out here and never shown; chatHistory still stores
// the raw marked-up text verbatim, since the model conditions on its own
// past formatting to keep producing it reliably.
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST):[ \t]?/;
const SEGMENT_MARKER_HOLDBACK = 6; // length of "GUEST:" — longest marker

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
    positions.push({ start: m.index, contentStart: m.index + m[0].length, speaker: m[1] === 'TICO' ? 'tico' : 'guest' });
  }
  if (positions.length === 0) {
    // No markers (older stored data, or the model skipped the format) — fall back to one guest bubble.
    if (rawText.trim()) createSegmentElement('guest').textContent = rawText.trim();
    return;
  }
  positions.forEach((pos, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].start : rawText.length;
    const text = rawText.slice(pos.contentStart, end).trim();
    if (text) createSegmentElement(pos.speaker).textContent = text;
  });
}

// Streaming variant of the same parsing — call createStreamRenderer() once
// per turn, then feed it the full accumulated text after every token.
function createStreamRenderer() {
  let consumedLen = 0;
  let speaker = null;
  let bubble = null;

  function appendToBubble(text) {
    if (!text) return;
    if (!bubble) {
      speaker = 'guest'; // safe fallback if the model ever forgets the opening marker
      bubble = createSegmentElement(speaker);
    }
    bubble.appendChild(document.createTextNode(text));
    scrollTranscriptToBottom();
  }

  return {
    update(fullTextSoFar) {
      for (;;) {
        const unconsumed = fullTextSoFar.slice(consumedLen);
        const m = SEGMENT_MARKER_RE.exec(unconsumed);
        if (m && m.index === 0) {
          speaker = m[1] === 'TICO' ? 'tico' : 'guest';
          bubble = createSegmentElement(speaker);
          consumedLen += m[0].length;
          continue;
        }
        if (m && m.index > 0) {
          appendToBubble(unconsumed.slice(0, m.index));
          consumedLen += m.index;
          continue;
        }
        // No marker in the unconsumed tail — hold back a few characters in
        // case they're the start of one still arriving token by token.
        if (unconsumed.length > SEGMENT_MARKER_HOLDBACK) {
          const safeLen = unconsumed.length - SEGMENT_MARKER_HOLDBACK;
          appendToBubble(unconsumed.slice(0, safeLen));
          consumedLen += safeLen;
        }
        break;
      }
    },
    finalize(fullText) {
      appendToBubble(fullText.slice(consumedLen));
      consumedLen = fullText.length;
    }
  };
}

async function sendTurn(message) {
  awaitingResponse = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const thinkingLine = appendThinking();
  const renderer = createStreamRenderer();
  let fullText = '';
  let learned = false;

  try {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'learn',
        userId: getOrCreateUserId(),
        message,
        chatHistory,
        restaurantId: currentRestaurantId,
        section: currentSection
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
        } else if (evt.type === 'tool_complete' && evt.tool === 'mark_section_learned') {
          learned = true;
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
    saveSectionState(currentRestaurantId, currentSection, chatHistory, currentChatId);
    if (flagButton) flagButton.hidden = false;

    if (learned) {
      showLearnedBanner();
      markSectionLearnedLocally(currentRestaurantId, currentSection);
      flushSectionChat(currentRestaurantId, currentSection, 'learned', { useBeacon: false });
    }
  } finally {
    awaitingResponse = false;
    answerInput.disabled = false;
    updateSendButton();
    answerInput.focus();
  }
}

function showLearnedBanner() {
  const banner = document.createElement('div');
  banner.className = 'learn-learned-banner';
  banner.textContent = `You've learned ${currentSection}!`;
  transcript.appendChild(banner);
  scrollTranscriptToBottom();
}

function startDrill() {
  const existing = loadSectionState(currentRestaurantId, currentSection);
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

// ─── Initial load ────────────────────────────────────────────────────
(async function () {
  const fallbackId = document.body.dataset.firstRestaurantId;
  currentRestaurantId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);
  applyRestaurantFilter('.menu-review__venue', currentRestaurantId);

  const { contentType, categorySlug } = parsePath(location.pathname);
  const type = contentType || getCurrentContentType();

  if (categorySlug) {
    const sectionName = findSectionBySlug(currentRestaurantId, type, categorySlug);
    if (sectionName) {
      // A reload mid-practice should stay in practice, not bounce back
      // to Review — resume it whenever a session already exists for this
      // section rather than always defaulting to Review on landing.
      const initialMode = loadSectionState(currentRestaurantId, sectionName) ? 'practice' : 'review';
      enterDetail(type, sectionName, initialMode, { pushUrl: false });
      return;
    }
  }
  enterBrowse(type, { pushUrl: false });
})();

// The nav switcher changes restaurant without reloading — re-filter and
// recompute the Train target in place. If we're mid-detail for the old
// restaurant, that content no longer applies — flush any in-progress
// practice session and drop back to browse rather than continuing on the
// wrong restaurant's section.
window.addEventListener('tico:restaurant-changed', (e) => {
  const previousRestaurantId = currentRestaurantId;
  currentRestaurantId = e.detail.restaurantId;
  applyRestaurantFilter('.menu-review__venue', currentRestaurantId);

  if (currentPhase === 'browse') {
    updateTrainLink(currentRestaurantId, currentContentType);
    return;
  }

  if (currentChatId) {
    flushSectionChat(previousRestaurantId, currentSection, 'exited', { useBeacon: false });
  }
  currentChatId = null;
  chatHistory = [];
  activeCorrectionCard = null;
  if (flagButton) flagButton.hidden = true;
  if (transcript) transcript.innerHTML = '';
  enterBrowse(currentContentType);
});

// Browser back/forward — no reload, so state has to be re-derived from
// the URL and re-applied manually. The Review/Practice toggle has no URL
// of its own, so back/forward always lands on Review for whichever
// category (or bare browse) the URL names.
window.addEventListener('popstate', () => {
  const { contentType, categorySlug } = parsePath(location.pathname);
  const type = contentType || getCurrentContentType();

  if (categorySlug) {
    const sectionName = findSectionBySlug(currentRestaurantId, type, categorySlug);
    if (sectionName) {
      const initialMode = loadSectionState(currentRestaurantId, sectionName) ? 'practice' : 'review';
      enterDetail(type, sectionName, initialMode, { pushUrl: false });
      return;
    }
  }
  enterBrowse(type, { pushUrl: false });
});

// ─── Delegated click handling ────────────────────────────────────────
// One handler for: the browse Food/Drinks switcher, clicking a category
// name (browse → detail), the Train link (browse → detail), the
// Review/Practice toggle, and the detail page's breadcrumb (detail →
// browse) — event delegation throughout since these elements exist once
// per restaurant/category, baked into the page, only one combination
// visible at a time.
function closeSwitcher(wrapper) {
  wrapper.classList.remove('is-open');
  wrapper.querySelector('.content-type-switcher').hidden = true;
  wrapper.querySelector('.page-title-switcher__trigger')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  const option = e.target.closest('.content-type-switcher__option');
  const trigger = e.target.closest('.page-title-switcher__trigger');

  if (option) {
    switchToBrowse(option.dataset.contentType);
    if (openSwitcher) closeSwitcher(openSwitcher);
    return;
  }

  if (trigger) {
    const wrapper = trigger.closest('.page-title-switcher');
    const willOpen = wrapper.querySelector('.content-type-switcher').hidden;
    if (openSwitcher) closeSwitcher(openSwitcher);
    if (willOpen) {
      wrapper.classList.add('is-open');
      wrapper.querySelector('.content-type-switcher').hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  if (openSwitcher && !openSwitcher.contains(e.target)) closeSwitcher(openSwitcher);

  const categoryLink = e.target.closest('.menu-category__name--link');
  if (categoryLink) {
    const panel = categoryLink.closest('.menu-content-panel');
    if (panel) enterDetail(panel.dataset.contentType, categoryLink.dataset.section, 'review');
    return;
  }

  const trainLink = e.target.closest('[data-train-link]');
  if (trainLink) {
    e.preventDefault();
    if (trainLink.dataset.targetSection) enterDetail(currentContentType, trainLink.dataset.targetSection, 'review');
    return;
  }

  const modeBtn = e.target.closest('.menu-detail__mode-btn');
  if (modeBtn) {
    setMode(modeBtn.dataset.mode);
    return;
  }

  const crumb = e.target.closest('.menu-detail__crumb');
  if (crumb) {
    e.preventDefault();
    switchToBrowse(currentContentType);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  if (openSwitcher) closeSwitcher(openSwitcher);
});
