# Plan: Unified Agent Architecture with Streaming Chat

## Problem Statement

1. **Immediate**: Chat requests timeout (30s) when context is large because Claude API calls can exceed the Netlify function timeout
2. **Strategic**: No autonomous agent execution exists - agents can only work during live chat sessions

## Architectural Solution

Extract shared agent logic into a reusable core, then use different delivery mechanisms for different use cases:

```
                              ┌─────────────────────────┐
                              │     Shared Agent Core   │
                              │  netlify/functions/     │
                              │  _agent-core/           │
                              │  - claude-client.cjs    │
                              │  - tool-handlers.cjs    │
                              │  - signal-parser.cjs    │
                              │  - system-prompts.cjs   │
                              └───────────┬─────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
 ┌────────▼────────┐           ┌─────────▼─────────┐          ┌─────────▼─────────┐
 │  Edge Function  │           │ Background Func   │          │ Scheduled Func    │
 │  agent-chat-    │           │ action-execute    │          │ scheduler         │
 │  stream.ts      │           │                   │          │                   │
 │                 │           │                   │          │                   │
 │ Streaming SSE   │           │ Autonomous work   │          │ Cron-triggered    │
 │ User waiting    │           │ Fire & forget     │          │ Research, digests │
 └─────────────────┘           └───────────────────┘          └───────────────────┘
```

## First PR Scope (Phases 1-2)

**Goal**: Fix the timeout problem with streaming chat

**New files:**
- `netlify/edge-functions/agent-chat-stream.ts` - Streaming endpoint
- `netlify/functions/agent-tool-execute.js` - Tool execution for edge function
- `netlify/functions/_agent-core/signal-parser.cjs` - Extracted signal parsing

**Modified files:**
- `src/do/agent-detail.njk` - Frontend streaming handler
- `netlify.toml` - Edge function path config (if needed)

**Not in first PR** (Phases 3-4):
- Background functions for autonomous execution
- Scheduled functions
- Full shared module extraction

---

## Implementation Phases

### Phase 1: Extract Shared Agent Core (Foundation)

Create reusable modules from current `agent-chat.js`:

**Files to create:**
- `netlify/functions/_agent-core/claude-client.cjs` - Anthropic client setup, streaming support
- `netlify/functions/_agent-core/tool-handlers.cjs` - All tool execution logic (get_action_details, update_action, etc.)
- `netlify/functions/_agent-core/signal-parser.cjs` - Parse GENERATE_ACTIONS, GENERATE_ASSET, STORE_MEASUREMENT
- `netlify/functions/_agent-core/system-prompts.cjs` - Build system prompts from agent context
- `netlify/functions/_agent-core/index.cjs` - Unified exports

**Changes to existing:**
- Refactor `agent-chat.js` to use extracted modules (keep working during transition)

### Phase 2: Edge Function for Streaming Chat

**Files to create:**
- `netlify/edge-functions/agent-chat-stream.ts` - Deno edge function
- `src/_includes/js/chat-stream.js` - Frontend EventSource handler

**How it works:**
1. Browser opens SSE connection to `/api/agent-chat-stream`
2. Edge function calls Claude with `stream: true`
3. Tokens streamed back to browser in real-time
4. Signals detected and returned at end of stream

**Edge function limitations & solutions:**
- Can't import `.cjs` directly → Use fetch to call internal endpoints for DB operations
- Or: Create lightweight validation endpoint that edge function calls

**Frontend changes:**
- Replace `fetch()` with `EventSource` for chat
- Handle incremental token updates
- Handle final signal payload (actions, measurements)

### Phase 3: Background Function for Autonomous Execution

**Files to create:**
- `netlify/functions/action-execute.js` - Execute a scheduled action
- `netlify/functions/action-execute-background.js` - Background wrapper (15 min timeout)

**How it works:**
1. Action reaches `scheduleTime` with state `scheduled`
2. Scheduler (Phase 4) or manual trigger calls `/api/action-execute`
3. Function loads action's `taskConfig.instructions`
4. Calls Claude API to execute the work
5. Stores output (Firestore for structured data, filesystem for local mode)
6. Updates action state to `completed`

**Uses shared core:**
- Same tool handlers (agents can use tools during execution)
- Same Claude client (non-streaming for background work)
- Same signal parsing (execution might generate sub-actions)

### Phase 4: Scheduled Function for Triggering Work

**Files to create:**
- `netlify/functions/scheduler.js` - Cron-triggered scheduler

**netlify.toml addition:**
```toml
[functions."scheduler"]
  schedule = "*/15 * * * *"  # Every 15 minutes
```

**How it works:**
1. Query Firestore for actions where `state = 'scheduled'` AND `scheduleTime <= now`
2. For each, trigger `action-execute-background`
3. Log execution starts for monitoring

---

## Detailed Phase 1 Implementation

### File: `_agent-core/claude-client.cjs`

```javascript
// Shared Anthropic client configuration
const Anthropic = require('@anthropic-ai/sdk');

function createClient(options = {}) {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: options.timeout || 20000
  });
}

// For edge functions (returns streaming response)
async function* streamMessage(client, params) {
  const stream = await client.messages.stream(params);
  for await (const event of stream) {
    yield event;
  }
}

// For background functions (returns complete response)
async function sendMessage(client, params) {
  return client.messages.create(params);
}

module.exports = { createClient, streamMessage, sendMessage };
```

### File: `_agent-core/tool-handlers.cjs`

Extract from agent-chat.js lines 27-387:
- `handleToolCall(toolBlock, userId, agentId, agent)`
- All individual tool implementations

### File: `_agent-core/signal-parser.cjs`

Extract signal detection logic:
- `parseSignals(responseText)` → returns { type, data } or null
- Types: GENERATE_ACTIONS, GENERATE_ASSET, STORE_MEASUREMENT

### File: `_agent-core/system-prompts.cjs`

Extract prompt building:
- `buildSystemPrompt(agent, options)` → returns system message array
- Options: includeActions, includeReviewContext, includeFilesystem

---

## Detailed Phase 2 Implementation

### File: `netlify/edge-functions/agent-chat-stream.ts`

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';

export default async function handler(req: Request): Promise<Response> {
  const { userId, agentId, message, chatHistory, systemPrompt, tools } = await req.json();

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let messages = [...chatHistory, { role: 'user', content: message }];
      let continueLoop = true;

      while (continueLoop) {
        // Stream Claude's response
        const response = client.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2048,
          system: systemPrompt,
          messages,
          tools
        });

        let fullContent = [];
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'token', text: event.delta.text });
          }
        }

        const finalMessage = await response.finalMessage();
        fullContent = finalMessage.content;

        // Check for tool use
        const toolUse = fullContent.find(b => b.type === 'tool_use');
        if (toolUse && finalMessage.stop_reason === 'tool_use') {
          send({ type: 'tool_start', tool: toolUse.name });

          // Execute tool via internal endpoint (keeps Firestore logic in Node.js)
          const toolResult = await fetch(new URL('/api/agent-tool-execute', req.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, agentId, toolUse })
          }).then(r => r.json());

          send({ type: 'tool_complete', tool: toolUse.name });

          // Add to messages for next iteration
          messages.push({ role: 'assistant', content: fullContent });
          messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }]
          });
        } else {
          continueLoop = false;
          // Parse signals from final text response
          const textBlock = fullContent.find(b => b.type === 'text');
          const signals = parseSignals(textBlock?.text || '');
          send({ type: 'done', signals, fullResponse: textBlock?.text });
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
}

function parseSignals(text: string) { /* extracted from agent-chat.js */ }

export const config = { path: '/api/agent-chat-stream' };
```

### File: `netlify/functions/agent-tool-execute.js` (New)

Lightweight endpoint for edge function to execute tools:
- Receives tool_use block from edge function
- Executes via existing `handleToolCall()` logic
- Returns result
- Keeps all Firestore logic in Node.js land

### Frontend Changes in `agent-detail.njk`

Update the chat submission to use streaming fetch:

```javascript
async function sendMessage(message) {
  const response = await fetch('/api/agent-chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentId, message, chatHistory, systemPrompt, tools })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines from buffer
    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'token') appendToken(data.text);
        if (data.type === 'done') handleCompletion(data.signals, data.fullResponse);
      }
    }
  }
}
```

---

## Critical Files to Modify

1. `netlify/functions/agent-chat.js` - Refactor to use shared core (keep working)
2. `src/do/agent-detail.njk` - Update chat JS to use streaming
3. `netlify.toml` - Add edge function config

## New Files

1. `netlify/functions/_agent-core/*.cjs` - Shared modules
2. `netlify/edge-functions/agent-chat-stream.ts` - Streaming endpoint
3. `src/_includes/js/chat-stream.js` - Frontend streaming handler

---

## Verification Plan

### Phase 1 Verification
- Existing `agent-chat.js` still works after refactor
- All tools still function correctly
- Signal parsing unchanged

### Phase 2 Verification
- Start local dev server with `netlify dev`
- Open agent chat, send message
- Verify tokens appear incrementally (not all at once)
- Verify signals (GENERATE_ACTIONS etc.) still work
- Test with large context that previously timed out

### Phase 3-4 Verification (Future)
- Manually trigger action-execute endpoint
- Verify action state transitions
- Verify output storage

---

## Decisions Made

1. **Extraction scope**: Incremental - extract only what's needed for streaming first

2. **Edge function DB access**: Minimal validation for now (userId/agentId from frontend)
   - Security note: This is fine for single-user/trusted context
   - Future-proofing: When opening to multiple orgs, add a lightweight validation endpoint that verifies agent ownership. Edge function calls this before streaming. Easy to add later without changing the streaming architecture.

3. **Tool handling in streaming**: Full support via sequential streams
   - Stream 1: Claude's initial response (user sees tokens immediately)
   - If tool_use detected: Execute tool via existing service layer
   - Stream 2: Claude's follow-up with tool results
   - User sees immediate feedback, no frozen UI during long context processing

4. **Fallback strategy**: Keep `agent-chat.js` working during transition, migrate incrementally
