# Tool Calling & Agent Logging Infrastructure

**Priority**: High — needed before debugging the feedback bug and before building Phase 3/4.

---

## Problem

The current system logs basic info (request timing, token counts, cache hits) but lacks visibility into:
- **What tools the agent calls** and with what arguments
- **Tool results** returned to the agent
- **Full LLM API call details** (system prompt, messages sent, response received)
- **Multi-turn tool use loops** (which tools fired in what order)
- **Cost tracking** per conversation/session
- **Error context** when tool calls fail silently (e.g., empty feedback fields)

Without this, debugging agent behavior (like the feedback bug) requires guesswork. We need structured logs that show exactly what happened during a conversation.

## Current Logging (agent-chat.js)

What exists today:
```
[agent-chat] Request started
[agent-chat] Added action context for: action-xxx (review)
[agent-chat] Review context: found 3 pending drafts (type: company)
[agent-chat] Claude API responded in 2341ms
[agent-chat] Token usage: { input_tokens: 4521, cache_creation: 1200, cache_read: 0, output_tokens: 890 }
[agent-chat] Processing 1 tool call(s)
[agent-chat] Tool submit_draft_review result: success
[agent-chat] Making follow-up API call after tool use
[agent-chat] Total request time: 4523ms
```

What's missing:
- Tool call arguments (what did Claude send?)
- Tool result payloads (what did the tool return?)
- The actual system prompt and messages sent
- Follow-up response content and tool calls
- Per-conversation cost tracking
- Structured format for querying/filtering

## Proposed Architecture

### Option A: Enhanced Console Logging (Minimal)

Add structured JSON logging to existing `console.log` calls. No new infrastructure.

```javascript
// Tool call logging
console.log(JSON.stringify({
  event: 'tool_call',
  tool: toolBlock.name,
  input: toolBlock.input,
  timestamp: new Date().toISOString()
}));

// Tool result logging
console.log(JSON.stringify({
  event: 'tool_result',
  tool: toolBlock.name,
  result: toolResult,
  success: toolResult.success !== false,
  timestamp: new Date().toISOString()
}));
```

**Pros**: Zero new dependencies, works with Netlify logs, immediate.
**Cons**: Not queryable, ephemeral (Netlify logs rotate), no dashboard.

### Option B: Firestore Logging Collection (Recommended)

[ User Note: One optimization we should make to the below plan is to save this data to LS, and only save it to the DB in response to specific events. There are two ways: 1. There is currently a "save" button in the chat UI. Clicking this saves the chat to the DB. This button could and perhaps should therefore also save the agent log data to the database. // 2. However, there are also "events" that cause this data to be automatically saved (and then cleared from LS after successful save). The main event pattern is if the purpose of the "session" / chat thread is complete. In other words, if the action was successfully created or completed. We need a bit of back and forth to understand what is the best pattern to implement here and how to implement it in a DRY way such that we reuse existing infrastructure and only improve or extend it as needed such that all agents in the system inherit this behavior. ]

Store structured logs in a `agent-logs` Firestore collection. Queryable, persistent, integrates with existing data layer.

**Schema:**
```javascript
{
  id: "log-{timestamp}-{random}",
  _userId: "u-...",
  agentId: "agent-...",
  sessionId: "session-{random}",   // Groups messages in one conversation
  type: "api_call" | "tool_call" | "tool_result" | "error",
  data: {
    // For api_call:
    model: "claude-sonnet-4-5-20250929",
    input_tokens: 4521,
    output_tokens: 890,
    cache_read_tokens: 0,
    cache_creation_tokens: 1200,
    duration_ms: 2341,
    cost_usd: 0.023,              // Computed from token counts
    has_tool_use: true,
    stop_reason: "tool_use",

    // For tool_call:
    tool_name: "submit_draft_review",
    tool_input: { draftId: "draft-xxx", score: 7, ... },

    // For tool_result:
    tool_name: "submit_draft_review",
    tool_output: { success: true, feedbackId: "feedback-xxx" },

    // For error:
    message: "...",
    stack: "..."
  },
  _createdAt: Firestore.Timestamp
}
```

**New service**: `netlify/functions/_services/db-agent-logs.cjs`
```javascript
exports.createLog = async (data) => { ... };
exports.getLogsBySession = async (sessionId) => { ... };
exports.getLogsByAgent = async (agentId, userId, { type?, limit? }) => { ... };
```

**New endpoint** (optional): `netlify/functions/agent-logs-list.js`
- For a future admin/debug UI to inspect conversations

**Integration into agent-chat.js:**
```javascript
const { createLog } = require('./_services/db-agent-logs.cjs');
const sessionId = `session-${Date.now().toString(36)}`;

// After API call
await createLog({
  _userId: userId,
  agentId,
  sessionId,
  type: 'api_call',
  data: {
    model: requestParams.model,
    input_tokens: apiResponse.usage.input_tokens,
    output_tokens: apiResponse.usage.output_tokens,
    cache_read_tokens: apiResponse.usage.cache_read_input_tokens || 0,
    cache_creation_tokens: apiResponse.usage.cache_creation_input_tokens || 0,
    duration_ms: Date.now() - apiCallStart,
    cost_usd: computeCost(apiResponse.usage),
    has_tool_use: toolUseBlocks.length > 0,
    stop_reason: apiResponse.stop_reason
  }
});

// After each tool call
await createLog({
  _userId: userId,
  agentId,
  sessionId,
  type: 'tool_call',
  data: { tool_name: toolBlock.name, tool_input: toolBlock.input }
});

// After each tool result
await createLog({
  _userId: userId,
  agentId,
  sessionId,
  type: 'tool_result',
  data: { tool_name: toolBlock.name, tool_output: toolResult }
});
```

**Pros**: Persistent, queryable, fits existing patterns, enables future debug UI.
**Cons**: Additional Firestore writes per conversation turn (2-6 writes per turn). Cost is negligible for a personal tool.

### Option C: Both (Recommended for debugging)

Use Option A (enhanced console logs) immediately for Netlify log inspection + Option B (Firestore) for persistent queryable data. Console logs are free and instant; Firestore logs enable future features.

## Cost Tracking

Token costs should be computed from usage data. Current model pricing (approximate):

```javascript
function computeCost(usage) {
  const inputCost = (usage.input_tokens / 1_000_000) * 3.00;  // $3/MTok
  const outputCost = (usage.output_tokens / 1_000_000) * 15.00; // $15/MTok
  const cacheCost = (usage.cache_read_input_tokens || 0) / 1_000_000 * 0.30; // $0.30/MTok
  return inputCost + outputCost + cacheCost;
}
```

Store per-call cost in logs. Aggregate per-agent and per-session costs via queries.

## Implementation Sequence

1. **Create `db-agent-logs.cjs`** — Firestore service for structured logs
2. **Add logging to `agent-chat.js`** — Log API calls, tool calls, tool results
3. **Add logging to `action-chat.js`** — Same patterns (if applicable)
4. **Create `agent-logs-list.js` endpoint** — For debug queries
5. **Add cost computation utility** — Token → USD conversion
6. **Optional: Simple debug UI** — View logs for a conversation session

## Files to Create

| File | Purpose |
|------|---------|
| `netlify/functions/_services/db-agent-logs.cjs` | Log CRUD service |
| `netlify/functions/agent-logs-list.js` | Debug query endpoint |
| `netlify/functions/_utils/cost-calculator.cjs` | Token → cost conversion |

## Files to Modify

| File | Change |
|------|--------|
| `netlify/functions/agent-chat.js` | Add structured logging after API + tool calls |
| `netlify/functions/action-chat.js` | Same logging if applicable |

## What This Enables

- **Debug the feedback bug**: See exactly what args Claude sent to `submit_draft_review`
- **Cost visibility**: Track spending per agent, per session, per day
- **Agent performance**: See which tools are used most, which fail, response times
- **Future features**: Conversation replay, audit trails, usage dashboards
- **Token optimization**: Identify conversations with high cache misses
