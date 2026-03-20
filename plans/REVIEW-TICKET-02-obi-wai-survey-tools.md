# TICKET-02: obi-wai-web — Fix Survey UX + Migrate STORE_MEASUREMENT to Survey Tools

**Phase**: App migration
**App**: `apps/obi-wai-web`
**Prerequisites**: TICKET-00 (survey-engine tool API must exist first)

---

## Goal

Two problems to fix:
1. **UX bug**: The app currently jumps straight into survey mode without consent — the opening message ignores any pending survey and just says "Hey, what would you like to talk about today?" but then delivers a survey on first reply anyway. Fix to match the Pidgerton consent-first pattern.
2. **Signal migration**: Replace `STORE_MEASUREMENT` signal with `store_survey_results` tool from `@habitualos/survey-engine`.

---

## Background

The Pidgerton (relationship-web) pattern for surveys is the reference implementation: on init, detect if there's an open survey action, and if so, have the agent open by acknowledging it and asking for consent. Only enter survey mode if the user says yes.

Currently obi-wai-web injects survey mode silently into the system prompt at init time, regardless of whether the user is ready. This creates the jarring "it suddenly starts asking survey questions" UX.

---

## Files to Modify

```
apps/obi-wai-web/
  netlify/functions/
    obi-wai-chat-init.js       ← fix consent-first flow, replace signal instructions with tool guidance
    practice-tool-execute.js   ← ADD survey tool routing (file may need to be created)
  netlify/edge-functions/
    chat-stream.ts             ← remove signalPatterns
  src/practice/
    chat.njk                   ← remove STORE_MEASUREMENT signal handling, add tool_complete handling
```

---

## Implementation

### Step 1: Fix `obi-wai-chat-init.js` — Consent-First Survey Flow

Read the current file carefully before editing. The current flow:
1. Checks `getOpenSurveyAction()` at init
2. If found, injects survey mode system prompt silently
3. This means Claude starts in survey mode before the user even says hello

**New flow:**

```javascript
// In obi-wai-chat-init.js, where survey detection happens:

const openSurvey = await getOpenSurveyAction('survey-obi-v1', userId);

let systemMessages;

if (openSurvey) {
  // Consent-first: tell Claude about the pending survey but let it ASK first
  systemMessages = [
    {
      role: 'user',
      content: buildSystemPrompt({ hasPendingSurvey: true, surveyActionId: openSurvey.id })
    }
  ];
} else {
  systemMessages = [
    {
      role: 'user',
      content: buildSystemPrompt({ hasPendingSurvey: false })
    }
  ];
}
```

In `buildSystemPrompt`, when `hasPendingSurvey: true`, include something like:

```
There is a pending check-in survey for this user (surveyActionId: ${surveyActionId}).
At the start of the conversation, mention this naturally and ask if they'd like to do it now.
For example: "Before we dive in — there's a quick check-in ready for you. Want to do that first, or would you rather just chat?"
If they say yes, call start_survey({ surveyActionId: "${surveyActionId}" }) to begin.
If they say no or later, respect that and proceed normally.
Do NOT start asking survey questions unless you have called start_survey first.
```

Remove the old survey mode system prompt injection (the block that switched the entire system prompt to survey delivery mode).

### Step 2: Add survey tools to the tools array in `obi-wai-chat-init.js`

Import and spread the survey tools from the package:

```javascript
const { surveyTools } = require('@habitualos/survey-engine');

// In the handler, when building tools to return:
const tools = [
  ...existingPracticeTools,  // get_practice_history, get_practice_detail
  ...surveyTools             // start_survey, submit_survey_answer, store_survey_results, abandon_survey
];
```

### Step 3: Update/Create `practice-tool-execute.js`

Check if this file already exists. If it does, add survey tool routing. If it doesn't, create it.

The file should handle tool execution calls from the edge function:

```javascript
const { handleSurveyTool, SURVEY_TOOL_NAMES } = require('@habitualos/survey-engine');
// ... existing practice tool handlers ...

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const { toolName, toolInput, userId } = JSON.parse(event.body);

  // Route survey tools to the package handler
  if (SURVEY_TOOL_NAMES.includes(toolName)) {
    const result = await handleSurveyTool(toolName, toolInput, { userId });
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  }

  // Route practice tools
  switch (toolName) {
    case 'get_practice_history':
      // ... existing handler ...
    case 'get_practice_detail':
      // ... existing handler ...
    default:
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolName}` }) };
  }
};
```

### Step 4: Update `netlify/edge-functions/chat-stream.ts`

Remove `signalPatterns`:

```typescript
// Before
{
  initEndpoint: '/api/obi-wai-chat-init',
  toolExecuteEndpoint: '/api/practice-tool-execute',
  signalPatterns: [/^STORE_MEASUREMENT\s*\n---/m],
}

// After
{
  initEndpoint: '/api/obi-wai-chat-init',
  toolExecuteEndpoint: '/api/practice-tool-execute',
  signalPatterns: [],
}
```

Ensure `toolExecuteEndpoint` is set to `/api/practice-tool-execute` (not null).

### Step 5: Update `src/practice/chat.njk`

**Remove**: Any code listening for `signal` SSE events or parsing STORE_MEASUREMENT JSON from the stream.

**Add**: `tool_complete` handler for `store_survey_results`:

```javascript
// In the SSE event handler in chat.njk:
if (event.type === 'tool_complete' && event.tool === 'store_survey_results') {
  const result = event.result;
  if (result.success && result.summary) {
    // Show a results summary in the UI
    // This can be a simple styled div injected after the tool indicator
    showSurveyResultsSummary(result.summary);
  }
}
```

Implement `showSurveyResultsSummary(summary)` to display a brief recap of scores (e.g., "Resistance: 7/10, Self-efficacy: 8/10") — styled consistently with the app's existing UI patterns.

Also handle `tool_complete` for `abandon_survey` — no UI action needed, just ensure the gray tool indicator shows naturally.

---

## Important Notes

- Read `obi-wai-chat-init.js` fully before editing — the survey mode injection may be deeply embedded in the system prompt builder. Don't break the normal (non-survey) chat flow.
- The `READY_TO_PRACTICE` marker in chat.njk — the audit noted this may be ceremonial. Check if it's actually parsed/acted on. If not, remove it.
- Verify `@habitualos/survey-engine` is listed in `apps/obi-wai-web/package.json` dependencies (it likely already is since surveys were already working).

---

## Acceptance Criteria

- Opening the chat with a pending survey: Claude acknowledges it and asks if user wants to do it now
- Saying "not now": Claude moves on to normal coaching conversation, no survey
- Saying "yes": Claude calls `start_survey`, receives instructions, asks questions one at a time
- After all answers: Claude summarizes and asks for confirmation before saving
- Confirming: `store_survey_results` fires, results summary appears in UI, action marked complete
- Saying "stop" mid-survey: Claude calls `abandon_survey`, conversation resumes normally
- No `STORE_MEASUREMENT` text ever appears in chat output
- Opening chat with NO pending survey: normal greeting, no mention of survey
