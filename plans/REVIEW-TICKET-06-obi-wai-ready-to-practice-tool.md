# TICKET-06: obi-wai-web — Migrate READY_TO_PRACTICE Signal to Tool

**Phase**: Standalone cleanup
**App**: `apps/obi-wai-web`
**Prerequisites**: None (independent)

---

## Goal

Replace the `READY_TO_PRACTICE` signal with a `show_practice_modal` tool. This eliminates the orphaned trailing text problem (Claude sometimes writes text after the signal, which currently gets stripped or displayed incorrectly) and removes the last remaining signal from obi-wai-web.

---

## Current Behavior

Claude emits:
```
READY_TO_PRACTICE
---
PRACTICE_NAME: LASSO
MESSAGE: I see you. Ready enough. Two or three minutes. Your body knows.
```

The client parses this with `parseReadySignal()`, strips it from display text via `getDisplayText()`, and shows the "I'm Ready" modal. Any text Claude writes after the signal is orphaned.

---

## New Behavior

Claude calls `show_practice_modal({ practiceName, message })`. The tool executes trivially server-side and echoes the inputs back as the result. The client catches `tool_complete` for this tool and shows the modal. Claude writes no text after the tool call — the modal IS the response.

---

## Files to Modify

```
apps/obi-wai-web/
  netlify/functions/
    obi-wai-chat-init.js       ← replace signal instructions with tool, add to tools array
    practice-tool-execute.js   ← add show_practice_modal handler
  netlify/edge-functions/
    chat-stream.ts             ← remove READY_TO_PRACTICE signalPattern
  src/practice/
    chat.njk                   ← remove parseReadySignal, getDisplayText, signal handling; add tool_complete handler
```

---

## Implementation

### Step 1: Add `show_practice_modal` to `practice-tool-execute.js`

Add a new case to the existing switch statement:

```javascript
case 'show_practice_modal': {
  const { practiceName, message } = toolInput;
  // Echo inputs back so client can use them from tool_complete result
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, practiceName, message })
  };
}
```

### Step 2: Update `obi-wai-chat-init.js`

**Add tool definition** to the `practiceTools` array (or wherever tools are defined before being returned):

```javascript
{
  name: 'show_practice_modal',
  description: "Show the 'I'm Ready' modal to the user, signaling they should begin their practice. Call this ONLY when the user has confirmed they want to practice NOW. Do not write any text after calling this tool — the modal is the response.",
  input_schema: {
    type: 'object',
    properties: {
      practiceName: {
        type: 'string',
        description: '1-3 words describing the practice, from the user\'s own language'
      },
      message: {
        type: 'string',
        description: 'Brief affirmation in Obi-Wai voice, 1-2 sentences'
      }
    },
    required: ['practiceName', 'message']
  }
}
```

**Replace the READY_TO_PRACTICE signal instructions** in the system prompt. Find the PHASE 3 section (around line 242-264) and replace with:

```
PHASE 3: READY CONFIRMATION
- ONLY when they confirm they want to practice NOW, call show_practice_modal with:
  - practiceName: 1-3 words from their own language describing what they'll do
  - message: a brief affirmation in Obi-Wai voice, 1-2 sentences
- Do not write any text after calling show_practice_modal. The modal is the response.
- If they say "later" or "not now", acknowledge supportively and end (do not call show_practice_modal).
```

### Step 3: Update `netlify/edge-functions/chat-stream.ts`

Remove the `READY_TO_PRACTICE` signal pattern:

```typescript
// Before
signalPatterns: [/^READY_TO_PRACTICE\s*\n---/m],

// After
signalPatterns: [],
```

### Step 4: Update `src/practice/chat.njk`

**Remove these functions entirely:**
- `parseReadySignal(text)` (lines ~283-308)
- `getDisplayText(text)` (lines ~310-315)

**Remove** any code that calls `getDisplayText()` to filter the display text — since signals are gone, the full Claude response can be rendered directly.

**Remove** the signal detection block that was checking `parsedSignal` or `signalData?.type === 'READY_TO_PRACTICE'` (around line 481).

**Add** a `tool_complete` handler for `show_practice_modal`. Find where other `tool_complete` events are handled (e.g. `store_survey_results`) and add:

```javascript
if (event.type === 'tool_complete' && event.tool === 'show_practice_modal') {
  const { practiceName, message } = event.result;
  showReadyModal(practiceName, message);
}
```

Where `showReadyModal(practiceName, message)` is the existing function/logic that populates and displays the "I'm Ready" modal overlay (currently triggered after signal parsing). Find that logic and keep it — just change the trigger from signal parsing to `tool_complete`.

---

## Important Notes

- Read `chat.njk` fully before editing. The signal parsing and modal display logic is interleaved — understand the full flow before removing pieces.
- The "I'm Ready" modal HTML (around line 87) does not need to change — only the trigger mechanism changes.
- After this ticket, `signalPatterns: []` in obi-wai's `chat-stream.ts` and all signal-related parsing code in `chat.njk` should be gone. obi-wai will be fully signal-free.
- Check whether `signalData` variable (line ~410) is used anywhere else besides `READY_TO_PRACTICE` handling — if not, remove it too.

---

## Acceptance Criteria

- User completes Phases 1 and 2 of coaching conversation
- On confirming "now": `show_practice_modal` tool fires, gray indicator appears, modal displays with practice name and message
- No `READY_TO_PRACTICE` text ever appears in chat output
- No orphaned trailing text after the modal trigger
- Saying "later": Claude responds normally, no modal
- `parseReadySignal`, `getDisplayText` functions removed from chat.njk
- `signalPatterns: []` in chat-stream.ts (was previously `[/^READY_TO_PRACTICE.../]`)
