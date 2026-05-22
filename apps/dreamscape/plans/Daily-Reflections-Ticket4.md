# Ticket 4: Reflect Chat — Frontend

## App Context
Dreamscape is a presence-based practice timer app (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS ES modules, SCSS compiled via 11ty. No external JS libraries.

Auth is localStorage-based — `dp-userId`, `dp-signed-in` keys. The `src/assets/js/auth/auth.js` module exports `isSignedIn()` and `getUserId()`.

**No `console.log`** — use `log()` from `src/assets/js/utils/log.js`. No uppercase/all-caps. No emojis. Dark mode only.

**Local dev:** `npm run dev` (http://localhost:8888). Must be signed in to test.

**Depends on Ticket 3** (backend endpoints must be working before testing the full flow).

---

## Phase 0: Explore First

Before implementing, read these files:
- `src/history.njk` — for the `.circle-header` pattern to reuse on the Reflect page
- `src/_includes/base.njk` — understand how `pageScript`, `bodyClass`, `noContainer`, `noFooter` work
- `src/assets/js/api.js` — the `get(path)` and `post(path, body)` helpers available
- `src/assets/js/auth/auth.js` — auth module exports
- `src/assets/js/utils/log.js` — log utility
- `src/styles/_variables.scss` — color/typography tokens
- `src/styles/_components.scss` — existing component styles (don't duplicate)
- `apps/obi-wai-web/src/assets/js/pages/practice-chat.js` — the obi-wai chat JS to port from
- `apps/obi-wai-web/src/practice/chat.njk` — obi-wai chat HTML to reference

After reading, check for any reusable patterns or utilities that already exist. Suggest DRY improvements before implementing.

---

## Key Architecture Decisions (do not deviate without user input)

1. **No tool indicators** — all AI tool use happens silently. While waiting: show ephemeral "Ruminating…" text only.
2. **No Save/Reset buttons** — chat auto-saves via practice.js on next page load.
3. **Full-screen ready overlay** — when AI calls `go_to_practice`, show a full-screen overlay (not a link, not a toast).
4. **`100dvh` height** — not `100vh`, to avoid mobile browser toolbar overlap.
5. **LS keys** (used by Ticket 5 to auto-save): `reflect-chat-history`, `reflect-chat-timestamp`, `reflect-chat-saved`

---

## API Contract (from chat-stream-core.ts — Ticket 3)

Frontend sends to `/api/chat-stream`:
```javascript
{
  chatType: 'reflect',
  userId: string,
  message: string,           // current user message
  chatHistory: Array<{ role: 'assistant'|'user', content: string }>,  // prior messages
  timezone: string,          // Intl.DateTimeFormat().resolvedOptions().timeZone
}
```

SSE events received:
```javascript
{ type: 'token', text: '...' }          // streaming text chunk
{ type: 'tool_start', tool: 'name' }   // ignored in this app (no indicators shown)
{ type: 'tool_complete', tool: 'go_to_practice', result: { practiceName, durationMins } }
{ type: 'done', fullResponse: '...' }
{ type: 'error', error: '...' }
```

---

## File 1: `src/reflect.njk`

```njk
---
layout: base.njk
title: Reflect — Daily Practice
permalink: /reflect/
pageScript: /assets/js/pages/reflect.js
noContainer: true
noFooter: true
bodyClass: scene-page
---

<div class="reflect-page">

  <div class="circle-header">
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3.8"
         stroke-linecap="round" stroke-linejoin="round"
         class="circle-icon circle-icon--lg" aria-hidden="true">
      <circle cx="48" cy="36" r="18"/>
      <path d="M24 80 C24 60 72 60 72 80"/>
    </svg>
    <div class="feed-message feed-visible">
      <span class="feed-name">Reflect</span>
    </div>
  </div>

  <div class="chat-messages" id="chat-messages"></div>

  <form class="chat-input-row" id="chat-form" autocomplete="off">
    <textarea
      id="message-input"
      class="chat-textarea"
      rows="1"
      placeholder="What's present for you today…"
      aria-label="Your message"
    ></textarea>
    <button type="submit" id="send-button" class="chat-send-btn" disabled aria-label="Send">→</button>
  </form>

</div>

<div id="ready-overlay" class="ready-overlay" hidden>
  <div class="ready-content">
    <p class="ready-label">ready to practice</p>
    <p class="ready-practice-name" id="ready-practice-name"></p>
    <p class="ready-duration" id="ready-duration"></p>
    <a href="#" id="begin-btn" class="ready-begin">Begin →</a>
    <button id="keep-chatting-btn" class="ready-dismiss">Keep chatting</button>
  </div>
</div>
```

Note on the SVG: This uses a simple person silhouette (circle head + path body). Check if there's an existing icon set or approach in the app; if so, match it.

---

## File 2: `src/assets/js/pages/reflect.js`

Port from `apps/obi-wai-web/src/assets/js/pages/practice-chat.js` with significant changes.

**Imports needed:**
```javascript
import { isSignedIn, getUserId } from '../auth/auth.js';
import { log } from '../utils/log.js';
```

**Auth guard (first thing in the module):**
```javascript
if (!isSignedIn() || !getUserId()?.startsWith('u-')) {
  window.location.replace('/signin/');
}
```

**LocalStorage helpers:**
```javascript
const LS_HISTORY   = 'reflect-chat-history';
const LS_TIMESTAMP = 'reflect-chat-timestamp';
const LS_SAVED     = 'reflect-chat-saved';
const TTL_MS       = 24 * 60 * 60 * 1000;

function loadHistory() {
  try {
    const ts = localStorage.getItem(LS_TIMESTAMP);
    if (ts && Date.now() - parseInt(ts, 10) > TTL_MS) {
      clearHistory();
      return [];
    }
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(history) {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    localStorage.setItem(LS_TIMESTAMP, String(Date.now()));
    // Mark as unsaved (practice.js will persist to Firestore when user navigates there)
    localStorage.setItem(LS_SAVED, 'false');
  } catch {}
}

function clearHistory() {
  [LS_HISTORY, LS_TIMESTAMP, LS_SAVED].forEach(k => localStorage.removeItem(k));
}
```

**DOM references:**
```javascript
const userId        = getUserId();
const chatMessages  = document.getElementById('chat-messages');
const chatForm      = document.getElementById('chat-form');
const messageInput  = document.getElementById('message-input');
const sendButton    = document.getElementById('send-button');
const readyOverlay  = document.getElementById('ready-overlay');
const beginBtn      = document.getElementById('begin-btn');
const keepChatBtn   = document.getElementById('keep-chatting-btn');

let chatHistory = loadHistory();
let streamingEl = null;
let streamingText = '';
```

**Render message (assistant or user):**
```javascript
function renderMessage(role, content) {
  const div = document.createElement('div');
  div.className = `chat-bubble chat-bubble--${role}`;
  // Simple: convert \n to <br>, escape HTML
  div.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

**Show/hide thinking placeholder:**
```javascript
let thinkingEl = null;

function showThinking() {
  thinkingEl = document.createElement('p');
  thinkingEl.className = 'chat-thinking';
  thinkingEl.textContent = 'Ruminating…';
  chatMessages.appendChild(thinkingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideThinking() {
  if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
}
```

**Streaming message element:**
```javascript
function startStreaming() {
  hideThinking();
  streamingText = '';
  streamingEl = document.createElement('div');
  streamingEl.className = 'chat-bubble chat-bubble--assistant';
  chatMessages.appendChild(streamingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendStreamToken(text) {
  streamingText += text;
  streamingEl.innerHTML = escapeHtml(streamingText).replace(/\n/g, '<br>');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function finalizeStreaming() {
  const text = streamingText;
  streamingEl = null;
  streamingText = '';
  return text;
}
```

**SSE streaming handler:**
```javascript
async function sendMessage(message) {
  // Add user message to UI and history
  renderMessage('user', message);
  chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
  saveHistory(chatHistory);

  sendButton.disabled = true;
  messageInput.disabled = true;

  showThinking();

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'reflect',
        userId,
        message,
        timezone,
        chatHistory: chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let started = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(part.slice(6));

          if (data.type === 'token') {
            if (!started) { startStreaming(); started = true; }
            appendStreamToken(data.text);
          } else if (data.type === 'tool_complete' && data.tool === 'go_to_practice') {
            const { practiceName, durationMins } = data.result;
            showReadyOverlay(practiceName, durationMins);
          } else if (data.type === 'done') {
            const text = finalizeStreaming();
            chatHistory.push({ role: 'assistant', content: text, timestamp: new Date().toISOString() });
            saveHistory(chatHistory);
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        } catch (parseErr) {
          log('warn', '[reflect] SSE parse error:', parseErr);
        }
      }
    }
  } catch (err) {
    log('warn', '[reflect] stream error:', err.message);
    hideThinking();
    if (streamingEl) streamingEl.remove();
    streamingEl = null;
    // Show error as assistant message
    renderMessage('assistant', 'Something went quiet. Try again.');
  }

  sendButton.disabled = false;
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
}
```

**Ready overlay:**
```javascript
function showReadyOverlay(practiceName, durationMins) {
  document.getElementById('ready-practice-name').textContent = practiceName;
  document.getElementById('ready-duration').textContent = `${durationMins} minute${durationMins !== 1 ? 's' : ''}`;
  beginBtn.href = `/practice/?practice=${encodeURIComponent(practiceName)}&duration=${durationMins}`;
  readyOverlay.hidden = false;
  sendButton.disabled = true;
}

keepChatBtn.addEventListener('click', () => {
  readyOverlay.hidden = true;
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
});
```

**Send button state:**
```javascript
function updateSendButton() {
  sendButton.disabled = messageInput.value.trim().length === 0;
}
```

**Form submit:**
```javascript
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message || sendButton.disabled) return;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  updateSendButton();
  await sendMessage(message);
});
```

**Textarea behavior (mobile vs desktop):**
```javascript
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
    // Mobile: default newline behavior
  }
});

messageInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
  updateSendButton();
});
```

**Init — render history and show opening message:**
```javascript
// Render existing chat history
chatHistory.forEach(msg => renderMessage(msg.role, msg.content));

// Show opening message if fresh session
if (chatHistory.length === 0) {
  const opening = {
    role: 'assistant',
    content: 'What would you like to practice today?',
    timestamp: new Date().toISOString(),
  };
  chatHistory.push(opening);
  saveHistory(chatHistory);
  renderMessage('assistant', opening.content);
}

messageInput.focus();
```

---

## File 3: Styles in `src/styles/_components.scss`

Color tokens from `src/styles/_variables.scss`:
```scss
$color-bg:         #0d0c1a;
$color-bg-surface: #13121f;
$color-text:       #e5e3f5;
$color-text-muted: #9ca3af;
$color-border:     #2a2845;
```

Append to `_components.scss`:
```scss
// ─── Reflect Page
.reflect-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;   // dvh avoids mobile browser toolbar overlap
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.chat-thinking {
  font-style: italic;
  opacity: 0.45;
  font-size: 0.9rem;
  align-self: flex-start;
  color: $color-text-muted;
}

.chat-bubble {
  max-width: 75%;
  line-height: 1.65;
  word-wrap: break-word;
  font-size: 1rem;
}

.chat-bubble--assistant {
  align-self: flex-start;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.05rem;
  color: $color-text;
  // No background — text sits directly on dark bg
}

.chat-bubble--user {
  align-self: flex-end;
  background: rgba(255, 255, 255, 0.07);
  padding: 0.55rem 0.85rem;
  border-radius: 12px 12px 2px 12px;
  color: $color-text;
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: $color-bg;
  position: sticky;
  bottom: 0;
}

.chat-textarea {
  flex: 1;
  resize: none;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid $color-border;
  border-radius: 8px;
  padding: 0.55rem 0.8rem;
  font-family: inherit;
  font-size: 0.95rem;
  color: $color-text;
  line-height: 1.4;
  max-height: 160px;
  overflow-y: auto;

  &::placeholder { color: $color-text-muted; opacity: 0.55; }
  &:focus { outline: none; border-color: rgba(255, 255, 255, 0.22); }
}

.chat-send-btn {
  flex-shrink: 0;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: $color-text;
  padding: 0.5rem 0.9rem;
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  transition: opacity 0.15s;

  &:disabled { opacity: 0.25; cursor: not-allowed; }
  &:not(:disabled):hover { background: rgba(255, 255, 255, 0.07); }
}

// ─── Ready Overlay
.ready-overlay {
  position: fixed;
  inset: 0;
  background: rgba(13, 12, 26, 0.92);  // $color-bg at 92% opacity
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;

  &[hidden] { display: none; }
}

.ready-content {
  text-align: center;
  padding: 2rem 1.5rem;
  max-width: 380px;
}

.ready-label {
  font-size: 0.78rem;
  color: $color-text-muted;
  margin: 0 0 0.5rem;
  letter-spacing: 0.03em;
}

.ready-practice-name {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 2.2rem;
  font-weight: 300;
  color: $color-text;
  margin: 0 0 0.3rem;
}

.ready-duration {
  font-size: 0.9rem;
  color: $color-text-muted;
  margin: 0 0 2rem;
}

.ready-begin {
  display: inline-block;
  padding: 0.65rem 2rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 99px;
  text-decoration: none;
  color: $color-text;
  font-size: 1rem;

  &:hover { background: rgba(255, 255, 255, 0.07); }
}

.ready-dismiss {
  display: block;
  margin: 1rem auto 0;
  background: none;
  border: none;
  color: $color-text-muted;
  font-size: 0.85rem;
  cursor: pointer;
  opacity: 0.5;

  &:hover { opacity: 0.8; }
}
```

---

## Verification

1. Navigate to `/reflect/` (signed in) → page loads with "Reflect" header and opening message
2. Type a message, submit → "Ruminating…" appears, then AI streaming response populates as assistant bubble (left, serif, no bg)
3. User messages appear right-aligned with subtle background
4. Desktop: Enter sends. Mobile (touch device): Enter adds a newline.
5. Textarea grows with content (up to max-height), then scrolls internally
6. Send button disabled when empty, enabled with content
7. Complete DISCOVERY → TIMING → confirm "now" with duration → ready overlay appears full-screen
8. Overlay shows correct practice name and duration
9. Click "Begin →" → navigates to `/practice/?practice=X&duration=Y`
10. Click "Keep chatting" → overlay hides, input re-enabled
11. Navigate away and back → chat history restored from localStorage
12. After 24h, localStorage cleared, fresh session starts (verify by setting timestamp to old value)
13. Not signed in → redirected to `/signin/`
