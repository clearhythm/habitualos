# TICKET-01: habitual-web — Migrate Signals to Tools

**Phase**: App migration (can run after TICKET-00, but actually independent — habitual-web's STORE_MEASUREMENT is not survey-engine based)
**App**: `apps/habitual-web`
**Prerequisites**: None (independent of TICKET-00)

---

## Goal

Replace the 3 typed signals (`GENERATE_ACTIONS`, `GENERATE_ASSET`, `STORE_MEASUREMENT`) in habitual-web with Claude API tools. Remove all signal parsing, buffering, and signal-format instructions from system prompts and client JS.

---

## Background

habitual-web currently emits structured text signals that get parsed server-side (signal-parser.cjs) and client-side (agent.js). `GENERATE_ACTIONS` is partially redundant — the app already has a `create_action` tool. `GENERATE_ASSET` and `STORE_MEASUREMENT` need new tools. After this migration, `signal-parser.cjs` can be deleted.

Note: habitual-web's `STORE_MEASUREMENT` is for **measurement-type actions** (check-ins against dimensions), NOT the survey-engine package. It's a distinct concept.

---

## Files to Modify

```
apps/habitual-web/
  netlify/functions/_agent-core/
    system-prompts.cjs          ← remove signal format instructions, update tool guidance
    signal-parser.cjs           ← DELETE
    tools-schema.cjs            ← add create_asset, store_measurement tools
    tool-handlers.cjs           ← add handlers for create_asset, store_measurement
  netlify/functions/
    agent-chat-init.js          ← remove signalPatterns, ensure new tools included
  netlify/edge-functions/
    chat-stream.ts              ← remove signalPatterns arrays
  src/assets/js/
    agent.js                    ← remove signal event handling, add tool_complete handling
```

---

## Implementation

### Step 1: Add `create_asset` tool to `tools-schema.cjs`

Add alongside existing tools:

```javascript
{
  name: "create_asset",
  description: "Create an immediate deliverable for the user — a piece of content, code, prompt, or markdown document. Use this when the user asks you to produce something concrete they can use right away.",
  input_schema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "The current agent's ID" },
      title: { type: "string", description: "Short descriptive title for the asset" },
      type: {
        type: "string",
        enum: ["markdown", "code", "prompt", "text"],
        description: "Format of the asset content"
      },
      content: { type: "string", description: "Full content of the asset" },
      language: { type: "string", description: "For code assets: the programming language" }
    },
    required: ["agentId", "title", "type", "content"]
  }
}
```

### Step 2: Add `store_measurement` tool to `tools-schema.cjs`

```javascript
{
  name: "store_measurement",
  description: "Store a measurement check-in for a measurement-type action. Use this when the user has provided scores or reflections for their tracked dimensions.",
  input_schema: {
    type: "object",
    properties: {
      actionId: { type: "string", description: "The measurement action ID (action-...)" },
      dimensions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            score: { type: "number", description: "Score 1-10" },
            notes: { type: "string" }
          },
          required: ["name", "score"]
        }
      },
      overallNotes: { type: "string", description: "Any overall reflection notes for this check-in" }
    },
    required: ["actionId", "dimensions"]
  }
}
```

### Step 3: Add handlers to `tool-handlers.cjs`

Look at the existing pattern in this file for `create_action` etc. and follow the same structure.

For `create_asset`: save to a Firestore `assets` collection (or whatever collection the old GENERATE_ASSET signal was writing to — check the existing signal handler in agent-chat.js to find the target collection). Fields: `agentId`, `title`, `type`, `content`, `language`, `_userId`, `_createdAt`.

For `store_measurement`: save a check-in record (look at where STORE_MEASUREMENT signal was writing to — likely a `measurements` or `check-ins` collection). Fields: `actionId`, `dimensions`, `overallNotes`, `_userId`, `_createdAt`. Also mark the measurement action as having a recent check-in if that logic exists.

### Step 4: Update `system-prompts.cjs`

- Remove the sections explaining signal format for GENERATE_ACTIONS, GENERATE_ASSET, STORE_MEASUREMENT
- Replace with tool-use guidance:
  - For actions: "Use `create_action` to create new actions for the user. Use `update_action` to modify existing ones."
  - For assets: "Use `create_asset` when the user asks you to produce a deliverable — code, a prompt, a document, etc."
  - For measurement check-ins: "When a user is checking in on a measurement-type action, collect all dimension scores conversationally, then call `store_measurement` with the results."

### Step 5: Update `agent-chat-init.js`

- Ensure `create_asset` and `store_measurement` are included in the tools array returned
- Remove any `signalPatterns` field if present

### Step 6: Update `netlify/edge-functions/chat-stream.ts`

Remove the `signalPatterns` arrays from the agent and fox-ea chat type configs:

```typescript
// Before
agent: {
  initEndpoint: '/api/agent-chat-init',
  toolExecuteEndpoint: '/api/agent-tool-execute',
  signalPatterns: [
    /^GENERATE_ACTIONS\s*\n---/m,
    /^GENERATE_ASSET\s*\n---/m,
    /^STORE_MEASUREMENT\s*\n---/m,
  ],
}

// After
agent: {
  initEndpoint: '/api/agent-chat-init',
  toolExecuteEndpoint: '/api/agent-tool-execute',
  signalPatterns: [],
}
```

### Step 7: Update `src/assets/js/agent.js`

- Remove any code that listens for `signal` SSE events or parses signal JSON
- Add `tool_complete` handling for the new tools:
  - `create_asset` tool_complete → render asset card in the chat UI (same visual treatment as the old GENERATE_ASSET signal produced)
  - `store_measurement` tool_complete → show a brief confirmation in chat (e.g., checkmark indicator)
  - `create_action` tool_complete → render action card (this may already be handled)
- The `tool_start` event (already handled for existing tools) should automatically show the gray "working" indicator — verify this covers new tools too

### Step 8: Delete `signal-parser.cjs`

After confirming no other file imports it:

```bash
grep -r "signal-parser" apps/habitual-web/netlify/
```

If no other imports found, delete the file.

---

## Important Notes

- Read `agent-chat.js` (the non-streaming fallback) to understand exactly what the old GENERATE_ACTIONS and GENERATE_ASSET signals were doing — specifically what data they wrote to Firestore and which collections. Match that behavior in the new tool handlers.
- The `create_action` tool already exists — GENERATE_ACTIONS was partially redundant. Just remove GENERATE_ACTIONS signal format from the system prompt; the tool already handles action creation.
- Check `agent-tool-execute.js` to confirm it routes to `tool-handlers.cjs` — add routing for `create_asset` and `store_measurement` there too.

---

## Acceptance Criteria

- Chat with an agent, ask it to create an action — `create_action` tool fires, gray indicator shows, action appears. No signal text visible.
- Ask agent to write a prompt for you — `create_asset` tool fires, asset card renders in UI.
- For a measurement-type action, complete a check-in conversationally — `store_measurement` tool fires, confirmation shown.
- No `GENERATE_ACTIONS`, `GENERATE_ASSET`, or `STORE_MEASUREMENT` text ever appears in the chat output.
- `signal-parser.cjs` deleted with no broken imports.
