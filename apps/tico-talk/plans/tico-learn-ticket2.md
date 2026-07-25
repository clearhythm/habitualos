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

**Why a tool at all, and why only one**: the drill needs the model to
judge, live, whether the trainee has demonstrated solid recall for the
section — and once it decides that, say so unmistakably in the UI (a
tool-triggered event the client can react to deterministically, not
something inferred from parsing prose). That's the only genuinely special,
discrete moment in this conversation. Evaluating each answer is *not*
special — it happens every round, so it's just normal turn content in the
plain streamed text, not a tool call.

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

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below. If something isn't in the data (a prep detail, an off-menu customization not noted in an item's own notes field), say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer — wait for real, repeated, demonstrated recall.

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

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: fullText });

    if (learned) {
      // Ticket 3 replaces this with a real, distinct visual treatment.
      appendLine('tico-aside', 'You’ve got this section down — nice work.');
    }
  } finally {
    awaitingResponse = false;
    answerInput.disabled = false;
    answerForm.querySelector('button').disabled = false;
    answerInput.focus();
  }
}
```

`startDrill()` (from Ticket 1) already calls `sendTurn('Let’s get
started.')` on entry — no change needed there, it now hits the new
streaming path automatically.

## File 8: `netlify/functions/learn-drill.cjs` (DELETE)

Fully superseded by Files 4 + 5 above. Confirm nothing else in the
codebase references `/api/learn-drill` before deleting (check
`src/assets/js/learn.js` for any leftover reference after your edit to
File 7).

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
   - After several correct answers in a row, at some point
     `mark_section_learned` fires (you'll see the "nice work" line) — this
     is a judgment call by the model, so it may take a varying number of
     rounds; that's expected for this ticket (Ticket 3 makes the moment
     itself more visually distinct).
   - Network tab: confirm the request goes to `/api/chat-stream`, not the
     old `/api/learn-drill` (which should 404 now that it's deleted).

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
