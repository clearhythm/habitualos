# TICKET-03: relationship-web — Migrate All Signals to Tools

**Phase**: App migration
**App**: `apps/relationship-web`
**Prerequisites**: TICKET-00 (survey-engine tool API for STORE_MEASUREMENT → store_survey_results)

---

## Goal

Replace all 3 typed signals (`SAVE_MOMENT`, `SEND_REPLY`, `STORE_MEASUREMENT`) with Claude API tools. Create a new `rely-tool-execute.js` endpoint (currently missing — toolExecuteEndpoint is null). Remove all client-side signal buffering and parsing from `chat.njk`.

---

## Background

relationship-web is the only app with zero tools and the most signals (3). It also has the "intelligent buffering" approach in chat.njk (dual streamingText/displayText to hide signals from UI). After this migration, all that buffering logic can be deleted, simplifying chat.njk significantly.

The `STORE_MEASUREMENT` signal maps directly to `store_survey_results` from the updated survey-engine package. `SAVE_MOMENT` and `SEND_REPLY` need new tools with handlers written in the app.

---

## Files to Modify / Create

```
apps/relationship-web/
  netlify/functions/
    rely-chat-init.js           ← remove signal instructions, add tool definitions
    rely-tool-execute.js        ← CREATE: tool execution endpoint
  netlify/edge-functions/
    chat-stream.ts              ← remove signalPatterns, set toolExecuteEndpoint
  src/
    chat.njk                    ← remove signal buffering, add tool_complete handling
```

---

## Implementation

### Step 1: Create `rely-tool-execute.js`

This file does not currently exist. Create it at `netlify/functions/rely-tool-execute.js`.

Look at `rely-chat-init.js` to understand what each signal was doing (what Firestore collections it wrote to, what data it stored) — replicate that exact behavior in the tool handlers below.

```javascript
const { handleSurveyTool, SURVEY_TOOL_NAMES } = require('@habitualos/survey-engine');
// Import db-core for moment/reply saves
const { create, patch } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { toolName, toolInput, userId } = JSON.parse(event.body);

  try {
    // Survey tools
    if (SURVEY_TOOL_NAMES.includes(toolName)) {
      const result = await handleSurveyTool(toolName, toolInput, { userId });
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    switch (toolName) {
      case 'save_moment': {
        const { person, content, tags } = toolInput;
        const id = `moment-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        await create('moments', id, {
          _userId: userId,
          person,
          content,
          tags: tags || [],
          _createdAt: new Date().toISOString()
        });
        return { statusCode: 200, body: JSON.stringify({ success: true, momentId: id }) };
      }

      case 'send_reply': {
        const { momentId, content } = toolInput;
        const replyId = `reply-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        await create(`moments/${momentId}/replies`, replyId, {
          _userId: userId,
          content,
          _createdAt: new Date().toISOString()
        });
        return { statusCode: 200, body: JSON.stringify({ success: true, replyId }) };
      }

      default:
        return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolName}` }) };
    }
  } catch (err) {
    console.error('rely-tool-execute error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
```

**Important**: Read `rely-chat-init.js` carefully — find where SAVE_MOMENT and SEND_REPLY signals were being handled (likely in client chat.njk or a dedicated endpoint). Match the exact Firestore collection names, field names, and data shapes already in use.

### Step 2: Update `rely-chat-init.js` — Replace Signal Instructions with Tool Guidance

**Remove** the system prompt sections that explain signal format for SAVE_MOMENT, STORE_MEASUREMENT, SEND_REPLY.

**Add** tool-use guidance in the system prompt instead:

For SAVE_MOMENT → `save_moment` tool:
```
When the user wants to capture a relationship moment, call save_moment with the person's name, the content of the moment, and any relevant tags. You can suggest saving after a meaningful story or reflection.
```

For SEND_REPLY → `send_reply` tool:
```
When the user is responding to a partner's moment (reply mode), call send_reply with the momentId and the user's reply content.
```

For STORE_MEASUREMENT (survey) — keep the consent-first pattern already working in this app:
```
If there is a pending survey action, mention it at the start and ask for consent. Call start_survey only after the user agrees.
```

**Add survey tools** to the tools array returned by this endpoint:

```javascript
const { surveyTools } = require('@habitualos/survey-engine');

// In the tools array:
const tools = [
  {
    name: "save_moment",
    description: "Save a relationship moment the user wants to capture — something meaningful that happened with someone important to them.",
    input_schema: {
      type: "object",
      properties: {
        person: { type: "string", description: "Name or relationship label of the person involved" },
        content: { type: "string", description: "Description of the moment" },
        tags: { type: "array", items: { type: "string" }, description: "Optional tags" }
      },
      required: ["person", "content"]
    }
  },
  {
    name: "send_reply",
    description: "Send a reply to a partner's relationship moment.",
    input_schema: {
      type: "object",
      properties: {
        momentId: { type: "string", description: "The ID of the moment being replied to" },
        content: { type: "string", description: "The reply content" }
      },
      required: ["momentId", "content"]
    }
  },
  ...surveyTools
];
```

### Step 3: Update `netlify/edge-functions/chat-stream.ts`

```typescript
// Before
rely: {
  initEndpoint: '/api/rely-chat-init',
  toolExecuteEndpoint: null,
  signalPatterns: [
    /^SAVE_MOMENT\s*\n---/m,
    /^STORE_MEASUREMENT\s*\n---/m,
    /^SEND_REPLY\s*\n---/m,
  ],
}

// After
rely: {
  initEndpoint: '/api/rely-chat-init',
  toolExecuteEndpoint: '/api/rely-tool-execute',
  signalPatterns: [],
}
```

### Step 4: Update `src/chat.njk` — Remove Buffering, Add Tool Handlers

**Remove the intelligent buffering logic** (the dual streamingText/displayText approach). This is no longer needed — tokens from Claude will never contain signal text.

Simplify to a single text buffer:

```javascript
// Replace the dual-buffer approach with:
let streamingText = '';

// In the token handler:
streamingText += chunk;
renderMessage(streamingText);
```

**Add `tool_complete` handlers:**

```javascript
if (event.type === 'tool_complete') {
  switch (event.tool) {
    case 'save_moment':
      // Show a subtle confirmation — e.g., a small "Moment saved ✓" badge
      showMomentSavedConfirmation(event.result);
      break;

    case 'send_reply':
      // Show reply sent confirmation, maybe navigate back to moments list
      showReplySentConfirmation(event.result);
      break;

    case 'store_survey_results':
      // Show survey results summary modal (match existing modal pattern in this app)
      showSurveyResultsModal(event.result.summary);
      break;
  }
}
```

Implement these UI functions to match the existing visual patterns in chat.njk (check what the old signal handling was rendering and replicate it via tool_complete).

---

## Important Notes

- Read `chat.njk` carefully before editing. The buffering logic (lines 307-347 per audit) is substantial — understand fully before removing.
- The `SAVE_MOMENT` and `SEND_REPLY` signal data shapes are defined in the old system prompt. Read them carefully to get the exact field names right for the new tool schemas.
- The `send_reply` tool needs a `momentId` — verify how reply mode currently receives the momentId (likely passed in via URL param or chat init context) and ensure it's available to Claude in the system prompt.
- Verify `@habitualos/survey-engine` is in `apps/relationship-web/package.json` dependencies.

---

## Acceptance Criteria

- Sharing a relationship moment → Claude calls `save_moment`, gray indicator shows, "Moment saved" confirmation appears. No signal text visible.
- Reply mode → Claude calls `send_reply`, gray indicator shows, confirmation appears.
- Pending survey + user consents → full survey flow via tools (same as TICKET-02 acceptance criteria).
- No `SAVE_MOMENT`, `SEND_REPLY`, or `STORE_MEASUREMENT` text ever appears in chat output.
- Dual-buffer code removed from chat.njk — single streamingText variable only.
- `toolExecuteEndpoint` no longer null — `rely-tool-execute.js` handles all tool calls.
