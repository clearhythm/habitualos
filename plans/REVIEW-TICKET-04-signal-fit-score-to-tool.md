# TICKET-04: signal app — Migrate FIT_SCORE_UPDATE to Tool

**Phase**: App migration
**App**: `apps/signal`
**Prerequisites**: None (independent)

---

## Goal

Replace the `FIT_SCORE_UPDATE` signal with an `update_fit_score` tool. The fit score sidebar currently updates whenever Claude emits `FIT_SCORE_UPDATE` text — migrate this to a tool call that the client handles via `tool_complete`.

---

## Background

`FIT_SCORE_UPDATE` is unique among the signals: it updates a persistent sidebar UI continuously throughout the conversation (not just once at the end). Claude is instructed to emit it after the initial response, then again whenever scores change significantly (≥1 point) or confidence changes (≥0.15).

As a tool, Claude calls `update_fit_score` at the same decision points. The tool executes trivially server-side (just returns `{ok: true}`), and the client updates the sidebar UI on `tool_complete`. This is cleaner — the update logic is explicit and typed.

There are 3 init endpoints (visitor, onboard, owner) that all use this signal — all 3 need updating.

---

## Files to Modify

```
apps/signal/
  netlify/functions/
    signal-visitor-init.js      ← remove FIT_SCORE_UPDATE signal format, add tool to schema
    signal-onboard-init.js      ← same
    signal-owner-init.js        ← same
    signal-tool-execute.js      ← add update_fit_score handler
  netlify/edge-functions/
    chat-stream.ts              ← remove signalPatterns
  src/assets/js/
    signal-modal.js             ← replace signal event handling with tool_complete
    embed.js                    ← same (embedded chat variant)
```

---

## Implementation

### Step 1: Add `update_fit_score` handler to `signal-tool-execute.js`

Read the existing file first — it currently handles `search_work_history`. Add the new tool:

```javascript
case 'update_fit_score': {
  const { skills, alignment, personality, overall, confidence, reason, nextStep } = toolInput;
  // Server-side execution is trivial — just acknowledge
  // The real action happens on the client via tool_complete
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      scores: { skills, alignment, personality, overall, confidence },
      reason: reason || null,
      nextStep: nextStep || null
    })
  };
}
```

### Step 2: Add `update_fit_score` tool schema to all 3 init endpoints

In `signal-visitor-init.js`, `signal-onboard-init.js`, and `signal-owner-init.js`, add this tool to the tools array returned:

```javascript
{
  name: "update_fit_score",
  description: "Update the fit score display based on what you've learned in the conversation. Call this after your initial response, and again whenever your assessment changes significantly (score change ≥1 or confidence change ≥0.15).",
  input_schema: {
    type: "object",
    properties: {
      skills: {
        type: "number",
        description: "Technical skills fit score 0-10"
      },
      alignment: {
        type: "number",
        description: "Values/working style alignment score 0-10"
      },
      personality: {
        type: "number",
        description: "Personality/culture fit score 0-10"
      },
      overall: {
        type: "number",
        description: "Overall fit score 0-10"
      },
      confidence: {
        type: "number",
        description: "Confidence in this assessment 0-1"
      },
      reason: {
        type: "string",
        description: "Brief explanation of the current assessment"
      },
      nextStep: {
        type: "string",
        description: "What should happen next (only include when confidence ≥ 0.65 and ≥ 4 turns have passed)"
      }
    },
    required: ["skills", "alignment", "personality", "overall", "confidence"]
  }
}
```

### Step 3: Update system prompts in all 3 init endpoints

**Remove**: The section explaining `FIT_SCORE_UPDATE` signal format (the `SIGNAL_NAME\n---\n{json}` instructions).

**Replace with** tool-use guidance:

```
After your initial response in this conversation, call update_fit_score with your current assessment.
Continue calling it whenever your assessment changes significantly (any score changes by ≥1 point, or confidence changes by ≥0.15).
Only include nextStep when confidence is ≥ 0.65 and at least 4 turns have passed.
```

### Step 4: Update `netlify/edge-functions/chat-stream.ts`

```typescript
// Remove signalPatterns from all 3 signal chat type configs:
'signal-visitor': {
  initEndpoint: '/api/signal-visitor-init',
  toolExecuteEndpoint: '/api/signal-tool-execute',
  signalPatterns: [],  // was: [/^FIT_SCORE_UPDATE\s*\n---/m]
},
'signal-onboard': {
  initEndpoint: '/api/signal-onboard-init',
  toolExecuteEndpoint: '/api/signal-tool-execute',
  signalPatterns: [],
},
'signal-owner': {
  initEndpoint: '/api/signal-owner-init',
  toolExecuteEndpoint: '/api/signal-tool-execute',
  signalPatterns: [],
},
```

### Step 5: Update `src/assets/js/signal-modal.js`

**Remove**: Any code listening for `signal` SSE events or parsing FIT_SCORE_UPDATE JSON.

**Add**: `tool_complete` handler for `update_fit_score`:

```javascript
// In the SSE event handler:
if (event.type === 'tool_complete' && event.tool === 'update_fit_score') {
  const { scores, reason, nextStep } = event.result;
  updateScoreDisplay(scores);
  if (reason) updateReasonText(reason);
  if (nextStep) showNextStep(nextStep);
}
```

Map these to the existing functions that were previously called when FIT_SCORE_UPDATE signal was parsed. The UI update logic itself should not need to change — just the trigger mechanism.

### Step 6: Update `src/assets/js/embed.js`

Same change as signal-modal.js — find the FIT_SCORE_UPDATE signal handling in the embedded chat variant and replace with `tool_complete` handling for `update_fit_score`.

---

## Important Notes

- Read `signal-modal.js` and `embed.js` carefully before editing — understand exactly what UI updates they perform on FIT_SCORE_UPDATE and replicate via tool_complete.
- The `update_fit_score` tool fires mid-conversation, potentially multiple times. Ensure the client handler is idempotent (calling it multiple times with updated scores just updates the display each time).
- The scoring thresholds (≥1 point change, ≥0.15 confidence change, ≥4 turns for nextStep) were previously enforced by the system prompt instructions. Move these same rules to the new tool-use guidance in the system prompt — Claude follows them the same way.
- The `search_work_history` tool in signal-tool-execute.js should remain unchanged.

---

## Acceptance Criteria

- Starting a conversation in visitor/onboard/owner mode: Claude calls `update_fit_score` after its first response. Gray tool indicator appears briefly. Sidebar/modal updates with scores.
- As conversation progresses and scores change: `update_fit_score` is called again, sidebar updates.
- `nextStep` label appears only after confidence threshold is met.
- No `FIT_SCORE_UPDATE` text ever appears in chat output.
- All 3 chat modes (visitor, onboard, owner) work correctly.
