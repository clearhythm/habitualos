# Ticket 3: Reflect Chat — Backend

## App Context
Dreamscape is a presence-based practice timer app (`apps/dreamscape`). Backend: Netlify Functions (Node.js CJS). Database: Firestore via `@habitualos/db-core`. AI: `@anthropic-ai/sdk`. Streaming: edge functions (Deno/TypeScript).

**No `console.log`** — use `log()` from `./_utils/log.cjs`. No uppercase/all-caps.

**Local dev:** `npm run dev` (Netlify dev at http://localhost:8888). API routes: `/api/*` → `/.netlify/functions/:splat`.

---

## Phase 0: Explore First

Before implementing, read these files:
- `netlify/edge-functions/_lib/chat-stream-core.ts` — understand the exact contract: what fields the init endpoint must return, what the tool-execute endpoint receives and must return
- `apps/obi-wai-web/netlify/functions/obi-wai-chat-init.js` — reference implementation of a working init function
- `apps/obi-wai-web/netlify/functions/practice-tool-execute.js` — reference tool execute function
- `netlify/functions/collections/sessions.cjs` — understand session data shape
- `netlify/functions/collections/users.cjs` — understand user data shape
- `netlify/functions/_utils/api.cjs` — the `handle(action, method, fn)` wrapper
- `netlify.toml` — confirm `/api/chat-stream` is already mapped to the `chat-stream` edge function

After reading, suggest any DRY opportunities (e.g., shared utilities, reusable patterns from obi-wai). Then implement.

---

## Overview
This ticket creates the full backend for the Reflect AI chat:
1. `netlify/edge-functions/chat-stream.ts` — routes the `reflect` chatType to our endpoints
2. `netlify/functions/reflect-chat-init.cjs` — builds system prompt + tools from user data
3. `netlify/functions/reflect-tool-execute.cjs` — executes tool calls
4. `netlify/functions/reflect-chat-save.cjs` — persists chat to Firestore

---

## Critical: chat-stream-core.ts Contract

**Init endpoint** (`reflect-chat-init`):
- Receives POST: `{ userId, timezone, userName }` (sent by core automatically)
- Must return: `{ systemMessages, tools }`
- `systemMessages` is passed directly as the `system` parameter to the Anthropic API — it should be a **string** (the system prompt text)
- `tools` is an array of Anthropic tool definitions

**Tool execute endpoint** (`reflect-tool-execute`):
- Receives POST: `{ userId, toolUse: { id, name, input } }` ← NOTE: `toolUse` object, not `tool`/`input` separately
- Must return: `{ result: <anything> }` ← NOTE: must be wrapped in `result` key
- The `result` is passed back to Claude as the tool result

**SSE Events sent to frontend:**
- `{ type: "token", text: "..." }` — streaming text chunk
- `{ type: "tool_start", tool: "<name>" }` — tool beginning execution
- `{ type: "tool_complete", tool: "<name>", result: <toolResult> }` — tool done
- `{ type: "done", fullResponse: "...", signal: null, hasSignal: false }` — stream complete
- `{ type: "error", error: "..." }` — error

The `go_to_practice` tool result is returned via `tool_complete` — the frontend reads `data.result.practiceName` and `data.result.durationMins` from that event.

---

## File 1: `netlify/edge-functions/chat-stream.ts`

```typescript
/**
 * Chat streaming edge function for dreamscape.
 * Uses shared core from packages/edge-functions.
 */
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "reflect": {
    initEndpoint: "/api/reflect-chat-init",
    toolExecuteEndpoint: "/api/reflect-tool-execute",
    signalPatterns: [],
  },
});

export const config = {
  path: "/api/chat-stream",
};
```

Note: `netlify.toml` already has `[[edge_functions]] path = "/api/chat-stream" function = "chat-stream"`. The `_lib/chat-stream-core.ts` is already present (copied by the `prestart` script). Just create this file.

---

## File 2: `netlify/functions/reflect-chat-init.cjs`

**Endpoint:** POST `/api/reflect-chat-init`
**Input:** `{ userId, timezone, userName }`
**Output:** `{ systemMessages: string, tools: Array }`

```javascript
const { getUser } = require('./collections/users.cjs');
const { getSessionsForUser } = require('./collections/sessions.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.chat.init', 'POST', async (event, { userId, timezone = 'America/Los_Angeles' }) => {
  if (!userId) throw new Error('userId required');

  const [user, sessions] = await Promise.all([
    getUser(userId),
    getSessionsForUser(userId),
  ]);

  const name = user?._name || 'friend';
  const recentSessions = (sessions || []).slice(0, 15);

  // Build time context using user's local timezone
  const now = new Date();
  const localDayTime = now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Last 10 unique practice names
  const recentNames = [...new Set(
    recentSessions.map(s => s.practiceType).filter(Boolean)
  )].slice(0, 10);

  // Last 3 notes (non-empty, 80-char preview)
  const recentNotes = recentSessions
    .filter(s => s.note && s.note.trim())
    .slice(0, 3)
    .map(s => `"${s.note.trim().slice(0, 80)}${s.note.length > 80 ? '…' : ''}"`);

  log('debug', '[reflect-chat-init] userId:', userId, 'name:', name, 'sessions:', recentSessions.length);

  const systemMessages = `You are reflecting with ${name}. Speak as a calm, grounded, present-tense voice — not a coach, not a cheerleader. Think of yourself as a slightly wiser, more settled version of the person you're talking to.

Your voice:
- Quiet and observant. Usually 2-3 sentences.
- "I notice..." and "What's present for you around..." language
- Not pressuring. Not cheerleading. Just clarity.
- Reference their history when relevant ("You've come back to breathwork three times recently...")

Quick context:
- Name: ${name}
- Local time: ${localDayTime}
- Recent practices (last 10): ${recentNames.length ? recentNames.join(', ') : 'none yet'}
- Recent notes: ${recentNotes.length ? recentNotes.join(' / ') : 'none'}

Tools:
- get_session_history: use when they ask about patterns, specific practices, or what they noticed
- go_to_practice: call ONLY when they've confirmed they want to practice NOW, with both name and duration

Conversation — 3 phases:

PHASE 1: DISCOVERY (4-6 exchanges)
Help them find what they want to practice. What's present. What's calling. Work through any resistance. Don't move to Phase 2 until they seem clear.

PHASE 2: TIMING + DURATION
Ask if they want to practice now or later.
- If later: acknowledge warmly, close the conversation. Do NOT call go_to_practice.
- If now: also ask how long they'd like to practice (or suggest a duration based on their history — look at typical durations if you have them). Once you have both — what and how long — move to Phase 3.

PHASE 3: READY
When they confirm NOW and you have a duration: call go_to_practice with practiceName and durationMins. Write nothing after calling this tool — the interface takes over.`;

  const tools = [
    {
      name: 'get_session_history',
      description: "Fetch the user's session history including reflections. Use when they ask about specific practices, patterns, or what they noticed.",
      input_schema: {
        type: 'object',
        properties: {
          practice_name: {
            type: 'string',
            description: 'Optional: filter to this practice name (case-insensitive)',
          },
          limit: {
            type: 'number',
            description: 'Max sessions to return (default 15, max 50)',
          },
        },
        required: [],
      },
    },
    {
      name: 'go_to_practice',
      description: 'Signal that the user is ready to practice NOW. Call ONLY when they have confirmed. Write nothing after calling this tool.',
      input_schema: {
        type: 'object',
        properties: {
          practiceName: {
            type: 'string',
            description: '1-3 words from their own language describing what they will practice',
          },
          durationMins: {
            type: 'number',
            description: 'How many minutes they want to practice',
          },
        },
        required: ['practiceName', 'durationMins'],
      },
    },
  ];

  return { systemMessages, tools };
});
```

---

## File 3: `netlify/functions/reflect-tool-execute.cjs`

**Endpoint:** POST `/api/reflect-tool-execute`
**Input:** `{ userId, toolUse: { id, name, input } }` ← core sends `toolUse` object
**Output:** `{ result: <anything> }` ← core reads `toolData.result`

```javascript
const { getSessionsForUser } = require('./collections/sessions.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.tool.execute', 'POST', async (event, { userId, toolUse }) => {
  if (!userId) throw new Error('userId required');
  if (!toolUse?.name) throw new Error('toolUse.name required');

  const { name: tool, input = {} } = toolUse;

  log('debug', '[reflect-tool-execute] tool:', tool, 'input:', input);

  if (tool === 'get_session_history') {
    const sessions = await getSessionsForUser(userId);
    let results = sessions || [];

    if (input.practice_name) {
      const filter = input.practice_name.toLowerCase();
      results = results.filter(s =>
        s.practiceType && s.practiceType.toLowerCase().includes(filter)
      );
    }

    const limit = Math.min(Number(input.limit) || 15, 50);
    results = results.slice(0, limit);

    return {
      result: results.map(s => {
        const startMs = s._startedAt instanceof Object
          ? s._startedAt.seconds * 1000
          : (s._startedAt || null);
        return {
          practiceType: s.practiceType || 'Practice',
          duration: s.duration ? `${Math.max(1, Math.round(s.duration / 60))} minutes` : null,
          note: s.note || null,
          when: startMs
            ? new Date(startMs).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })
            : null,
        };
      }),
    };
  }

  if (tool === 'go_to_practice') {
    return {
      result: {
        practiceName: input.practiceName,
        durationMins: input.durationMins,
      },
    };
  }

  throw Object.assign(new Error(`Unknown tool: ${tool}`), { statusCode: 400 });
});
```

---

## File 4: `netlify/functions/reflect-chat-save.cjs`

**Endpoint:** POST `/api/reflect-chat-save`
**Input:** `{ userId, messages, practiceName, durationMins }`
**Output:** `{ ok: true, chatId }`

```javascript
const { create, uniqueId } = require('@habitualos/db-core');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.chat.save', 'POST', async (event, { userId, messages, practiceName, durationMins }) => {
  if (!userId) throw new Error('userId required');
  if (!Array.isArray(messages)) throw new Error('messages array required');

  const chatId = uniqueId('rc');
  await create({
    collection: 'reflect-chats',
    id: chatId,
    data: {
      _userId: userId,
      messages,
      practiceName: practiceName || null,
      durationMins: durationMins || null,
      savedAt: new Date().toISOString(),
    },
  });

  log('debug', '[reflect-chat-save] chatId:', chatId, 'userId:', userId, 'messages:', messages.length);

  return { ok: true, chatId };
});
```

---

## Practice Log Data Shape (from collections/sessions.cjs, collection: `practice-logs`)

```javascript
// Each doc returned by getSessionsForUser(userId):
{
  _practiceId: string,      // unique ID
  _userId: string,
  _startedAt: Firestore Timestamp | Date,  // can be { seconds, nanoseconds } or Date
  _stoppedAt: Firestore Timestamp | null,
  name: string,             // user's display name at time of session
  practiceType: string,     // e.g. "breathwork", "meditation"
  duration: number,         // seconds practiced
  note: string | null,      // optional reflection note
}
```

---

## Verification

```bash
# Test init
curl -X POST http://localhost:8888/api/reflect-chat-init \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-YOURVALIDID","timezone":"America/Los_Angeles"}'
# Should return: { systemMessages: "You are reflecting with...", tools: [...] }

# Test tool execute - get_session_history
curl -X POST http://localhost:8888/api/reflect-tool-execute \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-YOURVALIDID","toolUse":{"id":"t1","name":"get_session_history","input":{}}}'
# Should return: { result: [...sessions] }

# Test tool execute - go_to_practice
curl -X POST http://localhost:8888/api/reflect-tool-execute \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-YOURVALIDID","toolUse":{"id":"t2","name":"go_to_practice","input":{"practiceName":"breathwork","durationMins":10}}}'
# Should return: { result: { practiceName: "breathwork", durationMins: 10 } }

# Test chat save
curl -X POST http://localhost:8888/api/reflect-chat-save \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-YOURVALIDID","messages":[{"role":"assistant","content":"Hello"}]}'
# Should return: { ok: true, chatId: "rc-..." }
```
