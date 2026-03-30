# TICKET: Build widget JS as modular ESM source

## Why this exists

The Signal widget currently has two diverged JS files:
- `src/assets/js/embed.js` — hand-written IIFE, ~800 lines, visitor mode only, external sites
- `src/assets/js/signal-modal.js` — ES module, ~730 lines, three-mode widget, Signal site only

Goal: one modular ESM codebase in `src/widget/` that esbuild bundles into `src/assets/js/embed.js` (IIFE). The Signal site and external sites both use the same built artifact. `signal-modal.js` and the hand-written `embed.js` are deleted.

**Prerequisites**:
- TICKET-esbuild-pipeline complete (esbuild running, `src/widget/index.js` entry point exists)
- TICKET-widget-css-extraction complete (`src/widget/widget.scss` exists, imported in `index.js`)

## Architecture

### Module structure

```
src/widget/
  index.js          ← esbuild entry point (imports widget.js + widget.scss)
  widget.js         ← orchestrator: public API, transition(), open/close
  widget.scss       ← (from Ticket 2, already exists)

  core/
    storage.js      ← visitor ID, owner session (localStorage)
    state.js        ← all mutable state in one place
    dom.js          ← HTML template injection, DOM ref binding
    messages.js     ← appendMessage, showThinking, renderMarkdown
    score.js        ← updateScore, resetScorePanel, renderNextStep, switchTab
    stream.js       ← SSE reader, event dispatch (token/tool_complete/done/error)
    eval.js         ← createEvalRecord, upsertEvalScores
    history.js      ← saveHistory, loadHistory, clearHistory, saveChat (chat persistence)

  modes/
    visitor.js      ← initVisitorMode, buildPayload, persist (chat save)
    owner.js        ← initOwnerMode, buildPayload, /signin auth command flow
    onboard.js      ← initOnboardMode, buildPayload
```

### Key architectural decisions

**1. CSS scoping: container ID, not class prefix**
All CSS in `widget.scss` is scoped to `#signal-embed-overlay`. Class names in the injected HTML use clean names (`.modal`, `.chat`, `.score`) — no `se-` prefix.

**2. Single userId source**
No `window.__userId` dependency. Visitor sessions: `getVisitorId()` from `storage.js`. Owner sessions: `getOwnerSession()` from `storage.js`. The Signal site no longer sets `window.__userId` for the widget.

**3. One HTML structure**
`dom.js` injects the widget HTML (no modal.njk HTML needed for the widget). `modal.njk` widget macro becomes just a `<script>` tag.

**4. Three modes, clean transitions**
`widget.js` owns `transition(modeName, options)` — the only path into any mode. Resets all state and UI, then delegates to the appropriate mode init. Modes are objects with `init()`, `buildPayload()`, and optional `persist()`.

**5. fullPage support**
`Signal.open({ fullPage: true })` adds `.is-fullpage` to the overlay (no backdrop, 100% dimensions). Used by signal.habitualos.com pages that display the widget full-screen.

**6. Compat aliases**
Keep `window.signalOpen` and `window.signalSwitchMode` as aliases on `window` for any Signal site page JS that calls them. These are wired up in `widget.js`.

---

## Module specifications

### `core/storage.js`
```js
export function getVisitorId()                 // creates/returns v-{ts}-{rand} from localStorage
export function getOwnerSession(signalId)      // returns session or null (checks TTL)
export function setOwnerSession(userId, signalId)
export function clearOwnerSession(signalId)
```
Session key: `signal_owner_{signalId}`. TTL: 30 days.

### `core/state.js`
Single mutable state object. Exported as a reference so all modules share it.
```js
export const state = {
  signalId: null,       // from data-signal-id attr
  baseUrl: null,        // from script.src origin
  activeMode: null,     // 'visitor' | 'owner' | 'onboard'
  isStreaming: false,
  chatHistory: [],
  chatId: null,
  currentPersona: null,
  turnCount: 0,
  lastScore: null,
  ownerConfig: null,
  ownerSession: null,
  currentEvalId: null,
  scoreCollapsed: false,
  authState: null,      // null | 'awaiting_email' | 'awaiting_code'
  authEmail: null,
  leadSubmitted: false,
};
export function resetChatState()  // resets everything except signalId, baseUrl, ownerConfig, ownerSession
```

### `core/dom.js`
```js
export function injectHTML(baseUrl)   // creates and appends #signal-embed-overlay to body
export function bindEls()             // queries all DOM refs, returns els object
export function initRing(els)         // sets ring strokeDasharray
```

The HTML template lives here as a template literal. Uses clean class names (`.modal`, `.chat`, etc.), all scoped by the container ID in CSS. Asset paths use `baseUrl` (absolute) so the widget works on external sites.

### `core/messages.js`
```js
export function appendMessage(els, role, text)  // returns content element
export function showThinking(els)
export function removeThinking()
export async function loadMarked()              // dynamically loads marked.js if not present
export function renderMarkdown(text)
```

### `core/score.js`
```js
export function resetScorePanel(els, RING_CIRCUMFERENCE)
export function updateScore(els, state, data)   // handles ring, bars, confidence, tab switch
export function switchTab(els, name)            // 'profile' | 'score'
export function renderNextStep(els, state, step, label)
```

### `core/stream.js`
```js
export async function readStream(res, handlers)
// handlers: { onToken, onToolComplete, onDone, onError }
// Parses SSE events from a fetch response, dispatches to handlers
```

### `core/eval.js`
```js
export function createEvalRecord(state, opts)   // fire-and-forget, sets state.currentEvalId on success
export function upsertEvalScores(state, scores) // fire-and-forget
```

### `core/history.js`
```js
export function saveHistory(state, chatHistoryKey)
export function loadHistory(state, chatHistoryKey, chatIdKey)  // returns bool
export function clearHistory(chatHistoryKey, chatIdKey)
export function saveChat(state, chatSaveUrl, chatHistoryKey, chatIdKey, messages)
```

### `modes/visitor.js`
```js
export async function init(state, els, baseUrl)
// Fetches signal-config-get + signal-context-status in parallel
// Populates left panel profile content (name, avatar, creds, contact)
// Renders persona buttons
// Sets input placeholder

export function buildPayload(state, text)
// Returns { userId, chatType: 'signal-visitor', signalId, persona, message, chatHistory }

export async function persist(state, saveChat)
// Saves chat via signal-chat-save
```

### `modes/owner.js`
```js
export async function init(state, els, baseUrl)
// Calls signal-owner-init, shows owner badge in header, enables input

export function buildPayload(state, text)
// Returns { userId, chatType: 'signal-owner', signalId, message, chatHistory, currentEvalId? }

export async function handleCommand(cmd, state, els, baseUrl)
// Handles /signin, /signout, awaiting_email, awaiting_code
// Returns true if command was consumed
```

### `modes/onboard.js`
```js
export async function init(state, els, baseUrl)
// Calls signal-onboard-init, shows opener message, enables input

export function buildPayload(state, text)
// Returns { userId, chatType: 'signal-onboard', message, chatHistory }
```

### `widget.js` (orchestrator)
```js
export async function transition(modeName, options, state, els)
// Resets chat UI and state
// Calls loadMarked()
// Delegates to mode init (visitor/owner/onboard)

export function open(options)   // shows overlay, triggers transition on first call or mode switch
export function close()
export function toggle()
export function init()          // called on DOMContentLoaded: injectHTML, bindEls, initRing, bindEvents, pre-load config
```

### `index.js` (entry point)
```js
import './widget.scss';
import { init, open, close, toggle } from './widget.js';
import { state } from './core/state.js';

// Read data attrs from currentScript
const script = document.currentScript;
state.signalId = script?.getAttribute('data-signal-id') || null;
state.baseUrl = script ? new URL(script.src).origin : 'https://signal.habitualos.com';

const modeAttr = script?.getAttribute('data-signal-mode');
const TESTING_MODE = modeAttr === 'testing' || modeAttr === 'coming-soon';

if (TESTING_MODE) {
  // coming-soon modal (small, no full widget)
  window.Signal = { open: openComingSoon, close: () => {}, toggle: openComingSoon };
} else {
  window.Signal = { open, close, toggle };
  window.signalOpen = (opts) => open(opts);           // compat alias
  window.signalSwitchMode = (mode, opts) => transition(mode, opts);  // compat alias

  function domReady(fn) { ... }
  domReady(init);
}
```

---

## Signal site integration changes

### `src/_includes/modal.njk`
Replace the entire `widget()` macro body (currently ~125 lines of HTML + script tags) with:
```njk
{% macro widget(signalId) %}
<script src="/assets/js/embed.js"{% if signalId %} data-signal-id="{{ signalId }}"{% endif %} defer></script>
{% endmacro %}
```
Keep the `confirm()` macro unchanged.

### `src/_includes/base.njk`
No changes needed. The `{% if showDemoModal %}` block still calls `{{ widget() }}`, which now renders the script tag. The signal-modal.js script tag was in modal.njk (now replaced), not base.njk.

### Signal site pages
Any page that calls `Signal.open()` or `window.signalOpen()` on load continues to work via the compat aliases. No page changes needed unless a page references `signal-modal.js` directly.

### `_widget.scss`
Remove the `// TODO: remove after TICKET-widget-js-modules ships` rules (the `signal-*` widget modal rules that were marked in Ticket 2). The widget no longer uses `signal-*` classes — they're replaced by the widget's own injected CSS.

---

## Files to delete after this ticket

- `src/assets/js/signal-modal.js`
- `src/assets/js/api.js` (only used by signal-modal.js — verify no other consumers first)

`src/assets/js/embed.js` is no longer hand-edited — it becomes a build artifact. It stays in git (see Ticket 1 decision), but should have a generated-file header comment.

---

## Local dev: watch mode

During development you'll want the widget to rebuild on every save. Update `start` in `package.json` to run the watcher and netlify dev in parallel:

```bash
npm install --save-dev concurrently
```

```json
"start": "concurrently \"node scripts/build-widget.js --watch\" \"netlify dev\""
```

This replaces the one-shot `npm run build:widget && netlify dev` added in Ticket 1. Same artifact, same code path — just continuous rebuild so the browser always has the latest bundle.

---

## Testing

Run existing tests after implementation:
```bash
node tests/api.test.js   # against local dev server
```

Manual smoke test checklist:
- [ ] External embed (paste script tag on a plain HTML page, open widget, have a visitor conversation, score updates)
- [ ] Signal site visitor mode (open widget, persona select, conversation, score panel populates)
- [ ] Signal site owner mode (`Signal.open({ mode: 'owner' })`, conversation, evaluate_fit tool renders eval card)
- [ ] Signal site onboard mode (`Signal.open({ mode: 'onboard' })`)
- [ ] `/signin` command flow in chat (email → code → owner session)
- [ ] Chat history restored on reload (visitor mode, external embed)
- [ ] Mobile layout (score bar visible, left panel hidden, sticky input)
- [ ] coming-soon mode (`data-signal-mode="coming-soon"`)

## Acceptance criteria

- [ ] `src/widget/` contains all modules per the structure above
- [ ] `npm run build:widget` produces a working `src/assets/js/embed.js`
- [ ] `signal-modal.js` deleted
- [ ] `modal.njk` widget macro is just a script tag
- [ ] All three modes work (visitor, owner, onboard)
- [ ] External embed works on a plain HTML page
- [ ] Signal site widget visually and functionally matches the pre-ticket experience
- [ ] All api.test.js tests pass
