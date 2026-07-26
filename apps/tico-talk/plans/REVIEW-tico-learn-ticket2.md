# Ticket 2: /learn/ drill — streaming backend + client integration

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). Frontend:
11ty + Nunjucks, vanilla JS ES modules. Backend: Netlify Functions
(Node.js CommonJS — `package.json` has `"type": "module"`, so top-level
function files must use the `.cjs` extension to use `require`/
`exports.handler`) plus Netlify **Edge Functions** (Deno runtime, `.ts`,
used only for streaming). AI: `@anthropic-ai/sdk` for the non-streaming
functions elsewhere in this app; this ticket uses raw `fetch()` to the
Anthropic API instead, inside the edge function (SDKs generally don't run
in Deno edge runtimes reliably — this is why the shared core avoids one).
No auth system exists in this app. No `console.log` in `.cjs` files — use
`log()` from `netlify/functions/_utils/log.cjs`.

**Depends on Ticket 1** — the drill phase's layout/markup/textarea must
already exist for this ticket's client code to render into.

**Why this ticket exists at all**: `/learn/`'s drill currently calls a
single non-streaming function (`netlify/functions/learn-drill.cjs`) that
returns one JSON blob per turn (`{guest, ticoAside, done}`). Two problems
with that, discovered during design of this feature:
1. A non-streaming call that also needs to do tool-calling (see "why a
   tool at all" below) means multiple sequential round-trips to
   Anthropic per user turn — call → tool_use → tool_result → follow-up
   call — which risks approaching a Netlify synchronous function's
   execution time limit, especially as the system prompt/history grows.
   Streaming avoids this because the connection stays open the whole
   time instead of blocking on one big response.
2. A JSON-envelope response can't be streamed token-by-token in any
   readable way — partial JSON fragments aren't renderable text. Once the
   response is plain natural language instead (this ticket), streaming
   works normally.

This app's monorepo already has a **proven, reusable streaming
architecture** for exactly this: `apps/dreamscape`'s `reflect` chat page
uses a shared core (`packages/edge-functions/chat-stream-core.ts`) that
each app copies into its own `netlify/edge-functions/_lib/` and
configures per "chat type." This ticket ports that pattern for a new
`"learn"` chat type — copying real, working code, not building streaming
from scratch.

## Phase 0: Explore First

Read these before starting — this ticket's code is adapted closely from
real working examples, not invented from scratch:

- `packages/edge-functions/chat-stream-core.ts` — the shared streaming
  core, in full. Understand: `RequestBody` interface, `ChatTypeConfig`,
  how `initEndpoint` and `toolExecuteEndpoint` get called, the SSE event
  types sent (`token`, `tool_start`, `tool_complete`, `done`, `error`),
  and the `userId` validation (must start with `"u-"`).
- `apps/dreamscape/netlify/edge-functions/chat-stream.ts` — the thin
  per-app config file (5 lines of actual config).
- `apps/dreamscape/netlify/functions/reflect-chat-init.cjs` — the
  `initEndpoint` pattern: receives `{userId, timezone}`, returns
  `{systemMessages, tools}`. Note `systemMessages` is an **array** of
  `{type: 'text', text: ..., cache_control: {type: 'ephemeral'}}` (not a
  plain string) — this enables Anthropic prompt caching on the system
  prompt across turns.
- `apps/dreamscape/netlify/functions/reflect-tool-execute.cjs` — the
  `toolExecuteEndpoint` pattern: receives `{userId, toolUse: {id, name,
  input}}`, returns `{result}`.
- `apps/dreamscape/netlify.toml` — the `[[edge_functions]]` entry format.
- `apps/dreamscape/src/assets/js/pages/reflect.js:176-314` — the client
  SSE-consumption pattern (`startStreaming`, `appendStreamToken`,
  `finalizeStreaming`, the `fetch` + `ReadableStream` reader loop parsing
  `data: ` lines).
- `apps/tico-talk/netlify/functions/learn-drill.cjs` — the file this
  ticket replaces. Read it fully; its system-prompt content and
  JSON-parsing logic get rewritten, not reused as-is (see below for why).
- `apps/tico-talk/src/assets/js/learn.js` — current `sendTurn()`,
  `appendLine()`, `appendThinking()` — you're replacing the network half
  of this file, not the rendering primitives (those stay, from Ticket 1).
- `packages/frontend-utils/utils.js` — `generateUserId()` (returns
  `'u-' + <8-char base36 string>`) — this is what satisfies
  `chat-stream-core.ts`'s `userId.startsWith("u-")` check.

## Overview

1. Copy the shared streaming core into this app, with one small addition
   (a `section` field the vanilla core doesn't have).
2. Add a thin edge-function config for a `"learn"` chat type.
3. Write `learn-chat-init.cjs` — the new system prompt (plain text, not a
   JSON envelope; Tico asks a question in character as the customer, the
   trainee answers, Tico evaluates that specific answer — **every round**,
   not rarely — then asks the next question) and a `tools` array
   containing one tool.
4. Write `learn-tool-execute.cjs` — executes that one tool. In this
   ticket it's a stub (Ticket 3 wires the real Firestore write).
5. Add a minimal `getOrCreateUserId()` helper — needed now because the
   streaming core requires a valid `"u-"`-prefixed userId to function at
   all, even though real per-user persistence isn't built until Ticket 3.
6. Rewrite `learn.js`'s network layer to consume the SSE stream instead
   of a single JSON fetch.
7. Delete `netlify/functions/learn-drill.cjs` — fully superseded.
8. Persist each section's transcript to localStorage (24h TTL, section
   switch clears it) so a reload doesn't lose an in-progress drill — see
   "Section persistence & reload state" below.
9. Reflect the current section + phase in the URL via
   `history.replaceState` (no full navigation), and make `#learn-picker`
   hidden-by-default in the markup so the correct phase is decided and
   shown synchronously on load instead of flashing the picker first — see
   the same section below.

**Why a tool at all, and why only one**: the drill needs the model to
judge, live, whether the trainee has demonstrated solid recall for the
section — and once it decides that, say so unmistakably in the UI (a
tool-triggered event the client can react to deterministically, not
something inferred from parsing prose). That's the only genuinely special,
discrete moment in this conversation. Evaluating each answer is *not*
special — it happens every round, so it's just normal turn content in the
plain streamed text, not a tool call.

**No signal for "new customer" transitions**: the drill isn't one flat
quiz — Tico should narrate a series of distinct, natural customer
interactions (a few exchanges with one imagined customer, a natural
wrap-up, then a new customer with a new mundane question), the same way
Ticket 1's original guest/Tico split did. But this transition is *not* a
discrete signal — no field, no tool, nothing the client parses or reacts
to. It has no UI consequence (same bubble styling, nothing resets,
nothing persists differently), so it's just prose, narrated by the model
in character, exactly like it would narrate anything else. `done` /
`scenario_complete` were considered and rejected for this reason — the
only moment that genuinely needs client-visible structure is
`mark_section_learned` (whole-section mastery), which is why that's the
one and only tool.

## File 1: `netlify/edge-functions/_lib/chat-stream-core.ts` (NEW)

Copy `packages/edge-functions/chat-stream-core.ts` verbatim, then apply
this one change — add a `section` field, since Learn needs to know which
menu section is being drilled and the vanilla core has no such concept
(only agent-specific and a few other named fields):

In the `RequestBody` interface, add:
```typescript
export interface RequestBody {
  userId: string;
  message: string;
  chatHistory: ChatMessage[];
  chatType?: string;
  section?: string; // ADDED: which menu section is being drilled (tico-talk "learn" chat type)
  // ...rest unchanged
}
```

In the handler, where `initBody` is constructed, change:
```typescript
// Before:
} else {
  // For other chat types (fox-ea, obi-wai, rely, etc.)
  initBody = { userId, timezone, userName };
  if (replyToMomentId) initBody.replyToMomentId = replyToMomentId;
}

// After:
} else {
  // For other chat types (fox-ea, obi-wai, rely, learn, etc.)
  initBody = { userId, timezone, userName };
  if (replyToMomentId) initBody.replyToMomentId = replyToMomentId;
  if (body.section) initBody.section = body.section;
}
```
And destructure `section` from `body` alongside the other fields near the
top of the handler. Everything else in the file is unchanged — this is a
2-line addition, not a rewrite.

## File 2: `netlify/edge-functions/chat-stream.ts` (NEW)

```typescript
/**
 * Chat streaming edge function for tico-talk.
 * Uses shared core (local copy) from ./_lib/chat-stream-core.ts.
 */
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "learn": {
    initEndpoint: "/api/learn-chat-init",
    toolExecuteEndpoint: "/api/learn-tool-execute",
    signalPatterns: [],
  },
});

export const config = {
  path: "/api/chat-stream",
};
```

## File 3: `netlify.toml` (MODIFY)

Find the existing `[[edge_functions]]` block (there's already one for
`auth`). Add, before it or after — order doesn't matter, Netlify matches
by `path`:

```toml
[[edge_functions]]
  path = "/api/chat-stream"
  function = "chat-stream"
```

## File 4: `netlify/functions/learn-chat-init.cjs` (NEW)

```javascript
const menuData = require('../../src/_data/menus/margaritaville.json');

function findSection(sectionName) {
  return menuData.categories.find((c) => c.name === sectionName) || null;
}

function buildSystemPrompt(section) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  return `You are Tico, a warm, experienced coworker helping a restaurant host/server-in-training drill their knowledge of one section of the menu: "${section.name}".

Each round works like this: you ask ONE question as if you were an ordinary customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question — real customers mostly ask ordinary things, never an unusual invented premise). The trainee answers. You then evaluate that specific answer — every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz — narrate it as a series of distinct customer interactions. After a handful of exchanges with one imagined customer, wrap that interaction up naturally in character (they say thanks, head off to their table, whatever fits) and bring in a new customer with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk — there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below. If something isn't in the data (a prep detail, an off-menu customization not noted in an item's own notes field), say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly, across however many customer interactions it takes, that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer — wait for real, repeated, demonstrated recall.

SECTION DATA (${section.name} only):
${JSON.stringify(trimmedItems, null, 2)}

Respond in plain natural language only — no JSON, no markdown formatting, no code fences. Start the drill now with your first question.`;
}

const tools = [
  {
    name: 'mark_section_learned',
    description: 'Call this once the trainee has demonstrated solid, repeated recall for this section — not on the first correct answer alone.',
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { section: sectionName } = JSON.parse(event.body || '{}');
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const section = findSection(sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    const systemMessages = [
      { type: 'text', text: buildSystemPrompt(section), cache_control: { type: 'ephemeral' } }
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemMessages, tools })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

Note this endpoint is called by the **edge function**, not directly by
the browser — it doesn't need `log()`/CORS handling beyond what's already
standard in this app's other functions, since edge-function-to-function
calls are server-to-server.

## File 5: `netlify/functions/learn-tool-execute.cjs` (NEW)

Stub for this ticket — Ticket 3 replaces the body of the
`mark_section_learned` branch with a real Firestore write.

```javascript
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toolUse } = JSON.parse(event.body || '{}');
    if (!toolUse || !toolUse.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'toolUse is required' }) };
    }

    if (toolUse.name === 'mark_section_learned') {
      // TODO (Ticket 3): write to the learn-progress Firestore collection.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { learned: true } })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolUse.name}` }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

## File 6: `src/assets/js/utils/user-id.js` (NEW)

Minimal — not full auth. `chat-stream-core.ts` requires a valid
`"u-"`-prefixed `userId` to do anything at all (it 400s otherwise), so
this has to exist for streaming to work even before Ticket 3's real
persistence is built.

```javascript
import { generateUserId } from '@habitualos/frontend-utils/utils.js';

const STORAGE_KEY = 'tico-user-id';

export function getOrCreateUserId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUserId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — generate a
    // session-only id rather than fail the request entirely.
    return generateUserId();
  }
}
```

Check the exact import path/specifier tico-talk's Vite setup expects for
workspace packages — other JS in this app may import
`@habitualos/frontend-utils` differently (check
`apps/tico-talk/eleventy.config.js`'s Vite `resolve.alias` config, which
already aliases this package, and confirm the subpath `/utils.js` resolves
correctly through it; adjust the import path if not).

## File 7: `src/assets/js/learn.js` (MODIFY)

Replace `sendTurn()` and the thinking/rendering helpers around it. Keep
`appendLine()`, `appendThinking()`, `showPhase()`, the picker/teach phase
handlers, and `startDrill()` from Ticket 1 as-is — only the network layer
changes.

Add the import at the top:
```javascript
import { getOrCreateUserId } from './utils/user-id.js';
```

Replace the existing `sendTurn` function with:

```javascript
let currentAssistantBubble = null;

function startStreamingBubble() {
  currentAssistantBubble = document.createElement('p');
  currentAssistantBubble.className = 'transcript-line transcript-line--guest';
  transcript.appendChild(currentAssistantBubble);
}

function appendStreamToken(text) {
  if (!currentAssistantBubble) startStreamingBubble();
  currentAssistantBubble.textContent += text;
  currentAssistantBubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function finalizeStreaming() {
  currentAssistantBubble = null;
}

async function sendTurn(message) {
  awaitingResponse = true;
  answerInput.disabled = true;
  answerForm.querySelector('button').disabled = true;
  const thinkingLine = appendThinking();
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
      appendLine('tico-aside', 'Couldn’t reach Tico just now — try again in a moment.');
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
          appendStreamToken(evt.text);
          fullText += evt.text;
        } else if (evt.type === 'tool_complete' && evt.tool === 'mark_section_learned') {
          learned = true;
        } else if (evt.type === 'done') {
          finalizeStreaming();
        } else if (evt.type === 'error') {
          finalizeStreaming();
          appendLine('tico-aside', evt.error || 'Something went wrong.');
        }
      }
    }

    chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    chatHistory.push({ role: 'assistant', content: fullText, timestamp: new Date().toISOString() });
    saveSectionState(currentSection, chatHistory, currentChatId);

    if (learned) {
      // Ticket 3 replaces this with a real, distinct visual treatment.
      appendLine('tico-aside', 'You’ve got this section down — nice work.');
      flushSectionChat(currentSection, 'learned', { useBeacon: false });
    }
  } finally {
    awaitingResponse = false;
    answerInput.disabled = false;
    answerForm.querySelector('button').disabled = false;
    answerInput.focus();
  }
}
```

Per-message `timestamp` fields are added here (they weren't in Ticket
1's original shape) because the persistence work below derives
`conversationStart`/`conversationEnd` from them, the same way
dreamscape's `reflect.js` does.

`startDrill()` (from Ticket 1) already calls `sendTurn('Let’s get
started.')` on entry — File 8 below changes when/whether it's called
(only for a genuinely fresh section, not a rehydrated one).

## File 8: `src/assets/js/learn.js` (MODIFY, continued) — section persistence & reload state

This is the code behind Overview items 8/9 and Ticket 3's "boundary
saves" — read `apps/dreamscape/src/assets/js/pages/reflect.js` in full
first (see Phase 0); this section adapts its `loadHistory`/`saveHistory`/
`clearHistory`/TTL/`persistChat` pattern to a **per-section** key instead
of reflect's single global chat.

Add the import (from Ticket 3):
```javascript
import { saveLearnChatBeacon, saveLearnChat } from './collections/learn-chats.js';
```

```javascript
// ─── Section chat persistence (localStorage) ───────────────────────────
// Every turn writes here — cheap, instant, local. Firestore is only
// touched at the three boundaries below (learned / exited / abandoned),
// not per turn — see Ticket 3's "Why boundary-triggered, not per-turn."
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function lsKey(section) {
  return `tico-learn-chat-${section}`;
}

function generateChatId() {
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Returns { chatId, history } for a fresh or rehydrated section, or null
// if there's nothing usable (caller should start a brand-new drill).
// A stale (TTL-expired) entry with real content gets flushed as
// 'abandoned' before being cleared — this is the one persistence path
// that runs even though the user never touched anything this visit.
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

let currentChatId = null;

// ─── URL state (section + phase) ────────────────────────────────────────
// Query params only, updated via replaceState — not a full navigation,
// and not a new template/route (see the ticket-1→2 discussion for why
// this was chosen over real per-section pages).
function updateUrlState(section, phase) {
  const params = new URLSearchParams();
  if (section) params.set('section', section);
  if (phase) params.set('phase', phase);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
```

**Forward dependency on Ticket 3**: unlike `learn-tool-execute.cjs`
(which Ticket 2 stubs and Ticket 3 replaces), this code imports
`./collections/learn-chats.js` directly with no stub — that file doesn't
exist until Ticket 3's File 9. The persistence half of this ticket
(everything above, plus the wiring below) can be written and reviewed
without it, but won't actually run end-to-end until Ticket 3's backend
pieces (File 6-9: the Firestore service, the two endpoints, and this
client wrapper) exist too. Build Tickets 2 and 3 in the same session, or
add a temporary local no-op stub for `saveLearnChatBeacon`/`saveLearnChat`
while testing the rest of Ticket 2 in isolation — implementer's call.

Wire these into the existing flow:

- **`showPhase(phase)`** (Ticket 1): call `updateUrlState(currentSection, phase)` at the end of it, so every phase transition keeps the URL in sync — no separate call sites needed elsewhere.
- **Teach → Drill button handler** and **picker pill click handler** (Ticket 1): unchanged otherwise, `showPhase()` already covers the URL update.
- **`startDrill()`** (Ticket 1): rewrite to check for rehydratable state first:
  ```javascript
  function startDrill() {
    const existing = loadSectionState(currentSection);
    transcript.innerHTML = '';
    if (existing) {
      currentChatId = existing.chatId;
      chatHistory = existing.history;
      chatHistory.forEach((m) => appendLine(m.role === 'user' ? 'user' : 'guest', m.content));
      answerForm.hidden = false;
    } else {
      currentChatId = generateChatId();
      chatHistory = [];
      answerForm.hidden = false;
      sendTurn('Let’s get started.');
    }
  }
  ```
- **`.learn-back` click handler** (Ticket 1, shared by Teach and Drill): the Teach-phase back link has nothing to flush. The Drill-phase one does — flush via `sendBeacon` since this is a real navigation:
  ```javascript
  document.querySelectorAll('.learn-back').forEach((link) => {
    link.addEventListener('click', () => {
      if (!drill.hidden) flushSectionChat(currentSection, 'exited', { useBeacon: true });
      currentSection = null;
      chatHistory = [];
      if (transcript) transcript.innerHTML = '';
      showPhase('picker');
    });
  });
  ```
- **Initial page load**: read `?section=` / `?phase=` from `location.search` before the first `showPhase()` call. If both are present and the section is a real one (validate against the rendered `.competency-pill[data-section]` list — don't trust the query string blindly), reveal `teach` or `drill` directly instead of defaulting to `picker`; if `phase=drill`, this also means calling `startDrill()` immediately (which itself calls `loadSectionState()` to decide fresh-vs-rehydrated). See File 9 for the markup change that makes this flash-free.

## File 9: `src/learn.njk` (MODIFY) — no flash of the picker on load

Ticket 1 left `#learn-picker` visible by default (only `#learn-teach` and
`#learn-drill` have `hidden`) — reasonable when there was no other state
to restore, but now the picker would flash before File 8's URL-driven
`showPhase()` call runs. Add `hidden` to it too:

```html
<!-- Before -->
<div class="learn-picker" id="learn-picker">

<!-- After -->
<div class="learn-picker" id="learn-picker" hidden>
```

Since all three phases now start hidden, the very first thing `learn.js`
must do (top-level, not inside a listener) is call `showPhase(...)` with
either `'picker'` or the URL-derived phase — confirm this actually runs
before first paint in practice, not just in theory (module scripts are
deferred, not blocking, so verify visually rather than assuming).

## File 10: `netlify/functions/learn-drill.cjs` (DELETE)

Fully superseded by Files 4 + 5 above. Confirm nothing else in the
codebase references `/api/learn-drill` before deleting (check
`src/assets/js/learn.js` for any leftover reference after your edits to
Files 7-8).

## Verification

1. `node --check` on `learn-chat-init.cjs`, `learn-tool-execute.cjs`, and
   the modified `learn.js`.
2. Manual review of `chat-stream-core.ts` (copied) and `chat-stream.ts` —
   no TypeScript build step in this app to lean on, so read them
   carefully instead.
3. **This requires `netlify dev`, not `eleventy:serve` — edge functions
   don't run under the plain Eleventy dev server.** Requires
   `ANTHROPIC_API_KEY` to be set in `apps/tico-talk/.env` (see the
   prerequisite note below) — if it's not set yet, you can still confirm
   the edge function/init endpoint wiring returns a sensible 500 rather
   than crashing, but the actual conversation won't work.
4. With the key in place: pick a section on `/learn/`, start the drill.
   Confirm:
   - Tico's first question streams in visibly, token by token (not a
     sudden full-paragraph dump).
   - Answering (correctly or incorrectly, try both) gets a real
     evaluation response, every time — not silence, not a generic "ok."
   - After a handful of exchanges, Tico narrates wrapping up with one
     customer and bringing in a new one, entirely in prose — confirm
     there's no visible "reset" (transcript keeps scrolling, no cleared
     state, no UI change) when this happens.
   - After several correct answers across possibly multiple customers, at
     some point `mark_section_learned` fires (you'll see the "nice work"
     line) — this is a judgment call by the model, so it may take a
     varying number of rounds; that's expected for this ticket (Ticket 3
     makes the moment itself more visually distinct).
   - Network tab: confirm the request goes to `/api/chat-stream`, not the
     old `/api/learn-drill` (which should 404 now that it's deleted).
5. **Reload continuity** (this ticket's persistence work, File 8): start
   a drill, answer once or twice, then reload the page directly (not via
   the back link). Confirm:
   - The URL after starting the drill looks like
     `/learn/?section=Tacos&phase=drill` (or similar), not bare `/learn/`.
   - The reload lands back on the drill screen for the same section, with
     the same transcript intact — not a flash of the picker first, and
     not an empty drill screen.
   - Answering again after reload continues the same `chatHistory`
     (confirm via the Network tab that `chatHistory` sent to
     `/api/chat-stream` includes the pre-reload turns, not just the new
     one).
6. **Section-switch isolation**: drill section A, answer once, back out to
   the picker, drill section B, answer once, then re-enter section A.
   Confirm section A's drill does *not* show section B's messages (each
   section's localStorage entry is independent) and that leaving A via
   the back link triggered an `'exited'` save (see Ticket 3's
   verification for confirming that landed in Firestore).

## Prerequisite (interactive — needs Erik, blocks live testing only)

A new `ANTHROPIC_API_KEY`, dedicated to tico-talk rather than reused from
another app:
1. Create a new API key in the Anthropic console, specifically for
   tico-talk.
2. Add it to `apps/tico-talk/.env` as `ANTHROPIC_API_KEY=...` (this file
   doesn't exist yet in this app — this step creates it). Don't paste the
   raw key into chat; just confirm once it's added.
3. Once in place, everything above can be exercised end to end via
   `netlify dev`.

The code in this ticket can be written, reviewed, and syntax-checked
without this — it only blocks step 3/4 of Verification above.
