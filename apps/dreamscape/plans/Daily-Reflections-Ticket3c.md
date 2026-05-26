# Ticket 3c: Reflect Chat — Natural Conversation End

## App Context

Dreamscape is a presence-based practice timer app (`apps/dreamscape`) within the HabitualOS monorepo. Backend: Netlify Functions (Node.js CJS). Database: Firestore via `@habitualos/db-core`. AI: `@anthropic-ai/sdk`. Streaming: Deno edge functions.

**No `console.log`** — use `log()` from `netlify/functions/_utils/log.cjs` (backend) or `src/assets/js/utils/log.js` (frontend). No uppercase/all-caps. Dark mode only.

**Local dev:** `npm run dev` from `apps/dreamscape/` (Netlify dev at http://localhost:8888). Must be signed in (`dp-userId`, `dp-signed-in` in localStorage) to test the reflect chat.

**Monorepo:** single `.git` at root. Working directories: `apps/dreamscape/` and `packages/`.

---

## Phase 0: Read These Files First

Before implementing, read:

1. `netlify/functions/reflect-chat-init.cjs` — full file. Understand: how the system prompt is built, how `go_to_practice` is defined in the tools array, what fields are returned (`systemPrompt`, `tools`, `model`, `maxTokens`).

2. `netlify/functions/reflect-tool-execute.cjs` — full file. Understand: how tool name + input are dispatched, what the `go_to_practice` handler looks like, what the return shape is.

3. `netlify/functions/reflect-chat-save.cjs` — full file (short). Understand the current fields written to Firestore and the `create()` call shape.

4. `src/assets/js/pages/reflect.js` — full file. Understand: the SSE event loop (search for `data.type === 'tool_complete'`), the `sendMessage()` function, the `LS_SAVED` and `dp-reflect-clear-next` localStorage keys and how they're currently used.

5. `netlify/edge-functions/_lib/chat-stream-core.ts` — skim only. Confirms: `tool_complete` SSE events are emitted as `{ type: 'tool_complete', tool: string, result: any }`. The result is whatever the tool-execute endpoint returns.

After reading, proceed. Do not deviate from the patterns you observe.

---

## Background

The reflect chat currently has one tool: `go_to_practice` — called when the AI routes the user to a practice session. But conversations often end naturally *without* a practice: the user decides to rest, says goodbye, or finishes reflecting. In these cases the chat should be saved to Firestore and cleared on the next visit — silently, with no user action required.

**Example conversation that should trigger this:**
```
User: "Ok fair enough, thank you for that reflection. See you soon."
AI:   "Rest well. See you soon."   ← then calls end_conversation({ outcome: "rest" })
```

The AI's farewell is the user-facing signal. The tool call is the system hook behind it — invisible to the user.

---

## Goal

When the AI calls `end_conversation`:
1. Client saves the full chat to Firestore (with an outcome label)
2. Client sets `dp-reflect-clear-next` so the chat clears on next load
3. No UI change — the conversation stays on screen so the user can re-read it
4. Next visit: fresh greeting, clean slate

---

## SSE Event Contract (do not change)

The edge function emits these SSE events (already implemented in `chat-stream-core.ts`):
```
{ type: 'token', text: '...' }
{ type: 'tool_start', tool: 'name' }
{ type: 'tool_complete', tool: 'name', result: { ...whatever tool-execute returns } }
{ type: 'done' }
{ type: 'error', error: '...' }
```

For `end_conversation`, `result` will be `{ ok: true, outcome: 'rest' }` — the client reads `data.result.outcome`.

---

## File 1: `netlify/functions/reflect-chat-init.cjs` (MODIFY)

### A. Add `end_conversation` to the tools array

In the returned `tools` array (next to `go_to_practice`), add:

```javascript
{
  name: 'end_conversation',
  description: 'Call this when the conversation has reached a natural conclusion — the user has said goodbye, chosen to rest, or indicated they are done for now without going to practice. Call it AFTER sending your final farewell message, never before.',
  input_schema: {
    type: 'object',
    properties: {
      outcome: {
        type: 'string',
        enum: ['rest', 'exploring', 'deferred', 'other'],
        description: '"rest": user chose sleep/rest. "exploring": user was testing or browsing. "deferred": wants to practice later, not now. "other": natural end with no clear category.',
      },
    },
    required: ['outcome'],
  },
}
```

### B. Add guidance to the system prompt

In the system prompt, near the existing `go_to_practice` instructions, add:

```
When the conversation reaches a natural conclusion — the user says goodbye, chooses rest, or is clearly done — send your final message first, then call end_conversation with the appropriate outcome. Do not call it mid-conversation or before your farewell.
```

---

## File 2: `netlify/functions/reflect-tool-execute.cjs` (MODIFY)

The tool-execute endpoint receives `{ tool, input, userId }` (confirm exact shape by reading the file). Add a handler for `end_conversation` alongside the existing `go_to_practice` handler.

The tool-execute does NOT write to Firestore — the client handles the save (it holds the full chat history; the tool-execute only receives the AI's tool input, not the full message history). Just log and return success with the outcome so it propagates back through the SSE `tool_complete` event.

```javascript
if (tool === 'end_conversation') {
  const { outcome } = input;
  log('debug', '[reflect-tool-execute] end_conversation outcome:', outcome, 'userId:', userId);
  return { ok: true, outcome };
}
```

Match the exact dispatch pattern you see in the file — don't restructure it.

---

## File 3: `netlify/functions/reflect-chat-save.cjs` (MODIFY)

Currently accepts `{ userId, messages, practiceName, durationMins }`. Add `outcome` as an optional field.

**Destructure:** add `outcome` to the parameter destructuring.

**Firestore write:** add `outcome: outcome || null` to the `data` object inside `create()`.

The full current file is short — read it, make the two targeted additions, do not change anything else.

---

## File 4: `src/assets/js/pages/reflect.js` (MODIFY)

### A. Handle `end_conversation` in the SSE loop

Find the `tool_complete` branch (search: `data.type === 'tool_complete'`). The current structure is:

```javascript
} else if (data.type === 'tool_complete') {
  if (data.tool === 'go_to_practice') {
    // ... existing go_to_practice handling
  } else if (streamingEl) {
    // ... existing fallback for other tools
  }
}
```

Add an `end_conversation` branch between `go_to_practice` and the fallback:

```javascript
} else if (data.tool === 'end_conversation') {
  const { outcome } = data.result;
  // Save to Firestore — fire and forget. Only if there are user messages.
  if (chatHistory.some(m => m.role === 'user')) {
    fetch('/api/reflect-chat-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, messages: chatHistory, outcome }),
    }).catch(() => {});
    localStorage.setItem(LS_SAVED, 'true');
  }
  // Schedule clear on next load — chat stays visible now
  localStorage.setItem('dp-reflect-clear-next', '1');
}
```

Note: `userId`, `chatHistory`, and `LS_SAVED` are already module-level variables. `reflect.js` uses `fetch()` directly throughout — do not introduce an `api.js` helper here.

### B. Cancel scheduled clear if user continues typing

After `end_conversation` fires, `dp-reflect-clear-next` is set. If the user then types another message, their continuation would be wiped on next load. Fix: at the top of `sendMessage()`, just after `saveHistory(chatHistory)` is called, add:

```javascript
// If user continues after a natural end, cancel the scheduled clear
localStorage.removeItem('dp-reflect-clear-next');
```

`saveHistory()` already resets `LS_SAVED = 'false'`, so the continuation will need to be re-saved on the next `end_conversation` or manual clear. Two Firestore docs may result — this is acceptable.

---

## Outcome Values Reference

| Value | When |
|---|---|
| `rest` | User chose sleep, rest, said they're tired |
| `exploring` | User was testing, browsing, just curious |
| `deferred` | Wants to practice, but not right now |
| `other` | Natural end, no clear category |

These power the Ago activity feed (see `Feature-Ago-Activity-Feed.md`) — "had a conversation, chose rest" — without needing to read the full transcript.

---

## What Does NOT Change

- No UI change when `end_conversation` fires — conversation stays visible
- `go_to_practice` behavior is entirely unchanged
- The 24h TTL (`TTL_MS`) still runs as fallback for sessions where neither tool is called
- The `dp-reflect-clear-next` auto-clear block in the init section of `reflect.js` is unchanged

---

## Verification

1. **Natural end without practice:** Have a complete conversation that ends gracefully. After the AI's farewell:
   - No UI change on screen
   - Firestore `reflect-chats` has a new doc with correct `messages` array and `outcome` field
   - `localStorage['reflect-chat-saved'] === 'true'`
   - `localStorage['dp-reflect-clear-next'] === '1'`

2. **Next visit clears correctly:** Reload after a natural end → fresh greeting appears, old conversation gone

3. **Continuation edge case:** After AI says goodbye, type another message. Verify:
   - `dp-reflect-clear-next` is removed from localStorage
   - `reflect-chat-saved` is `'false'` (saveHistory reset it)
   - New messages survive a reload

4. **go_to_practice unchanged:** A conversation that ends in practice — verify `end_conversation` is never called, overlay appears as before, no regression

5. **No user messages guard:** If `end_conversation` fires before the user has sent any message (unlikely but defensive), verify nothing is saved to Firestore

6. **Outcome accuracy:** Engineer a "rest" scenario and an "exploring" scenario — verify the correct enum value appears in Firestore
