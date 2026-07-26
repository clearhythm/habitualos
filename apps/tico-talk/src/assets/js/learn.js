// /learn/ — text-based teach-then-drill practice. Tico presents a
// section's real facts first (no quiz), then plays a series of realistic
// guest interactions that drill the trainee on it, streamed over SSE via
// /api/chat-stream (shared core: packages/edge-functions/chat-stream-core.ts).
import { getOrCreateUserId } from './utils/user-id.js';
import { saveLearnChatBeacon, saveLearnChat } from './collections/learn-chats.js';

const picker = document.getElementById('learn-picker');
const teach = document.getElementById('learn-teach');
const drill = document.getElementById('learn-drill');
const transcript = document.getElementById('learn-transcript');
const answerForm = document.getElementById('learn-answer-form');
const answerInput = document.getElementById('learn-answer-input');
const sendButton = document.getElementById('learn-send-btn');

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

let currentSection = null;
let currentChatId = null;
let chatHistory = [];
let awaitingResponse = false;

// ─── URL state (section + phase) ────────────────────────────────────────
// Query params only, updated via replaceState — not a full navigation.
function updateUrlState(section, phase) {
  const params = new URLSearchParams();
  if (section) params.set('section', section);
  if (phase) params.set('phase', phase);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function sectionExists(name) {
  return Array.from(document.querySelectorAll('.learn-picker .competency-pill'))
    .some((p) => p.dataset.section === name);
}

function showPhase(phase) {
  picker.hidden = phase !== 'picker';
  teach.hidden = phase !== 'teach';
  drill.hidden = phase !== 'drill';
  updateUrlState(currentSection, phase);
}

// ─── Section chat persistence (localStorage) ────────────────────────────
// Every turn writes here — cheap, instant, local. Firestore is only
// touched at three boundaries (learned / exited / abandoned), not per
// turn — see collections/learn-chats.js (stub for now, Ticket 3 wires
// the real Firestore write).
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function lsKey(section) {
  return `tico-learn-chat-${section}`;
}

function generateChatId() {
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Returns { chatId, history } for a fresh or rehydrated section, or null
// if there's nothing usable (caller should start a brand-new drill). A
// stale (TTL-expired) entry with real content gets flushed as
// 'abandoned' before being cleared.
function loadSectionState(section) {
  try {
    const raw = localStorage.getItem(lsKey(section));
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (Date.now() - state.timestamp > TTL_MS) {
      if (state.history?.some((m) => m.role === 'user')) {
        flushSectionChat(section, 'abandoned', { useBeacon: false, stateOverride: state });
      }
      localStorage.removeItem(lsKey(section));
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function saveSectionState(section, history, chatId) {
  try {
    localStorage.setItem(lsKey(section), JSON.stringify({ chatId, history, timestamp: Date.now() }));
  } catch {}
}

function clearSectionState(section) {
  try { localStorage.removeItem(lsKey(section)); } catch {}
}

// Single save path for all three boundaries. useBeacon: true for saves
// that coincide with navigating away ('exited'); false where the tab
// stays open ('learned', TTL-driven 'abandoned' flush on load).
function flushSectionChat(section, action, { useBeacon, stateOverride } = {}) {
  const state = stateOverride || { chatId: currentChatId, history: chatHistory };
  if (!state.history?.some((m) => m.role === 'user')) return; // nothing worth saving
  const payload = {
    chatId: state.chatId,
    userId: getOrCreateUserId(),
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
  clearSectionState(section);
}

// ─── Learned badges (picker) ─────────────────────────────────────────────
// Mirrors the Firestore write client-side so the picker can badge learned
// sections without a network round-trip on every page load.
function markSectionLearnedLocally(sectionName) {
  try {
    const learned = JSON.parse(localStorage.getItem('tico-learned-sections') || '{}');
    learned[sectionName] = true;
    localStorage.setItem('tico-learned-sections', JSON.stringify(learned));
  } catch {
    // non-fatal — the picker just won't show the badge until next real fetch
  }
}

function applyLearnedBadges() {
  let learned = {};
  try {
    learned = JSON.parse(localStorage.getItem('tico-learned-sections') || '{}');
  } catch {}
  document.querySelectorAll('.learn-picker .competency-pill').forEach((pill) => {
    if (learned[pill.dataset.section]) {
      pill.classList.add('competency-pill--learned');
    }
  });
}
applyLearnedBadges();

function showLearnedBanner() {
  const banner = document.createElement('div');
  banner.className = 'learn-learned-banner';
  banner.textContent = `You've learned ${currentSection}!`;
  transcript.parentElement.insertBefore(banner, transcript.nextSibling);
  banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// Picker → Teach
document.querySelectorAll('.learn-picker .competency-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    currentSection = pill.dataset.section;
    document.querySelectorAll('.learn-teach__section').forEach((section) => {
      section.hidden = section.dataset.section !== currentSection;
    });
    showPhase('teach');
  });
});

// Back links, from either Teach or Drill
document.querySelectorAll('.learn-back').forEach((link) => {
  link.addEventListener('click', () => {
    if (!drill.hidden) flushSectionChat(currentSection, 'exited', { useBeacon: true });
    currentSection = null;
    chatHistory = [];
    if (transcript) transcript.innerHTML = '';
    showPhase('picker');
  });
});

// Teach → Drill
document.querySelectorAll('.learn-start-drill').forEach((button) => {
  button.addEventListener('click', () => {
    showPhase('drill');
    startDrill();
  });
});

function appendLine(speaker, text) {
  const line = document.createElement('p');
  line.className = `transcript-line transcript-line--${speaker}`;
  line.textContent = text;
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function appendThinking() {
  const line = document.createElement('p');
  line.className = 'transcript-line transcript-line--tico learn-thinking';
  line.textContent = 'Tico’s thinking…';
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
    saveSectionState(currentSection, chatHistory, currentChatId);

    if (learned) {
      showLearnedBanner();
      markSectionLearnedLocally(currentSection);
      applyLearnedBadges();
      flushSectionChat(currentSection, 'learned', { useBeacon: false });
    }
  } finally {
    awaitingResponse = false;
    answerInput.disabled = false;
    updateSendButton();
    answerInput.focus();
  }
}

function startDrill() {
  const existing = loadSectionState(currentSection);
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

// ─── Initial load: restore section + phase from the URL, if present, so
// a reload doesn't bounce back to the picker. Nothing renders until this
// runs — see learn.njk, all three phases start `hidden`.
(function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const phase = params.get('phase');

  if (section && sectionExists(section) && (phase === 'teach' || phase === 'drill')) {
    currentSection = section;
    document.querySelectorAll('.learn-teach__section').forEach((el) => {
      el.hidden = el.dataset.section !== currentSection;
    });
    showPhase(phase);
    if (phase === 'drill') startDrill();
    return;
  }

  showPhase('picker');
})();
