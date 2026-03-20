# TICKET-00: Add Tool-Based Sub-Agent API to survey-engine Package

**Phase**: Foundation — must complete before TICKET-02 and TICKET-03
**App**: `packages/survey-engine`
**Prerequisites**: None

---

## Goal

Extend `@habitualos/survey-engine` with a tool-handler layer so any app can deliver surveys as a Claude tool-based sub-agent interaction — no signals, no client-side buffering. The package owns the prompting contract (one question at a time, reflect briefly, verbal confirm before saving, easy off-ramp) so every app gets identical conversational survey behavior for free.

---

## Background

Currently, surveys are delivered via a `STORE_MEASUREMENT` signal embedded in Claude's text output. The client must buffer the stream, strip the signal, and parse JSON from it. This is fragile and leaks code-like text if buffering fails.

The new pattern: Claude conducts the survey conversationally using 4 tools. The "sub-agent" behavior comes from the tool result briefing Claude on how to proceed — no system prompt swap, no new conversation thread, conversation continuity preserved.

---

## Files to Create/Modify

```
packages/survey-engine/
  src/
    tools/
      schema.cjs        ← NEW: JSON schema definitions for 4 survey tools
      handlers.cjs      ← NEW: tool execution handlers (called by app tool-execute endpoints)
      prompts.cjs       ← NEW: the survey prompting contract Claude receives in start_survey result
  index.cjs             ← MODIFY: export new tools/ exports
```

---

## Implementation

### 1. Create `packages/survey-engine/src/tools/schema.cjs`

Export an array of 4 tool definitions for use in any app's `chat-init` endpoint:

```javascript
const surveyTools = [
  {
    name: "start_survey",
    description: "Begin a survey conversation. Returns the survey questions and instructions for how to conduct the survey conversationally. Call this when the user has consented to take a survey.",
    input_schema: {
      type: "object",
      properties: {
        surveyActionId: {
          type: "string",
          description: "The ID of the open survey action (sa-...) for this user"
        }
      },
      required: ["surveyActionId"]
    }
  },
  {
    name: "submit_survey_answer",
    description: "Record the user's answer to a single survey question. Call this after the user answers each question.",
    input_schema: {
      type: "object",
      properties: {
        surveyActionId: { type: "string" },
        dimension: { type: "string", description: "The dimension name being answered" },
        score: { type: "number", description: "Numeric score 1-10" },
        notes: { type: "string", description: "Any qualitative notes from the user's answer" }
      },
      required: ["surveyActionId", "dimension", "score"]
    }
  },
  {
    name: "store_survey_results",
    description: "Save all collected survey answers to the database. Only call this AFTER verbally confirming with the user that they are ready to save. Returns a summary of what was stored.",
    input_schema: {
      type: "object",
      properties: {
        surveyActionId: { type: "string" },
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string" },
              score: { type: "number" },
              notes: { type: "string" }
            },
            required: ["dimension", "score"]
          }
        }
      },
      required: ["surveyActionId", "scores"]
    }
  },
  {
    name: "abandon_survey",
    description: "Cancel the current survey without saving. Call this if the user asks to stop, skip, or come back later.",
    input_schema: {
      type: "object",
      properties: {
        surveyActionId: { type: "string" },
        reason: { type: "string", description: "Why the survey is being abandoned" }
      },
      required: ["surveyActionId"]
    }
  }
];

module.exports = { surveyTools };
```

### 2. Create `packages/survey-engine/src/tools/prompts.cjs`

The survey prompting contract — this is what Claude receives as the `start_survey` tool result. It defines the UX behavior for all apps:

```javascript
function buildSurveyPrompt({ questions, surveyActionId, focusDimensions }) {
  const questionList = questions.map((q, i) => `${i + 1}. **${q.dimension}**: ${q.text}`).join('\n');
  const focusNote = focusDimensions && focusDimensions.length > 0
    ? `\nPrioritize these dimensions first (areas for growth): ${focusDimensions.join(', ')}.`
    : '';

  return {
    surveyActionId,
    questions,
    instructions: `You are now conducting a check-in survey. Follow these guidelines carefully:

**Conversation style:**
- Ask ONE question at a time. Never batch questions.
- After the user answers, briefly reflect back what you heard in 1 sentence before moving on.
- Ask a short follow-up only if the answer was very brief or unclear — not every time.
- Keep the whole survey feeling like a natural conversation, not a form.

**Off-ramp:**
- If at any point the user seems reluctant, rushed, or says anything like "not now", "skip", "later", or "stop" — offer to abandon the survey with abandon_survey. Never push through resistance.

**Saving results:**
- When all questions are answered, briefly summarize what you heard across all dimensions.
- Ask the user: "Does that feel right? I can save this check-in now."
- Only call store_survey_results AFTER the user confirms.
- If they want to change something, let them before saving.

**Questions to ask:**
${questionList}
${focusNote}

Begin by asking the first question naturally.`
  };
}

module.exports = { buildSurveyPrompt };
```

### 3. Create `packages/survey-engine/src/tools/handlers.cjs`

Tool execution handlers. Apps call these from their `tool-execute` endpoint:

```javascript
const { getSurveyDefinition, getOpenSurveyAction, createSurveyResponse, markActionCompleted } = require('../index.cjs');
const { buildSurveyPrompt } = require('./prompts.cjs');

async function handleStartSurvey({ surveyActionId }, { userId }) {
  const action = await getOpenSurveyAction(null, userId);
  // Fall back to direct lookup if needed
  if (!action) {
    return { error: 'No open survey found for this user.' };
  }

  const definition = await getSurveyDefinition(action.surveyDefinitionId);
  if (!definition) {
    return { error: 'Survey definition not found.' };
  }

  const questions = definition.dimensions.map(d => ({
    dimension: d.name,
    text: d.questions[0] // use the first question for each dimension
  }));

  return buildSurveyPrompt({
    questions,
    surveyActionId: action.id,
    focusDimensions: action.focusDimensions || []
  });
}

async function handleSubmitAnswer({ surveyActionId, dimension, score, notes }, { userId }) {
  // Lightweight acknowledgement — answers are batched and saved in store_survey_results
  // This tool exists so Claude can call it per-question, giving the client tool_complete events
  return { ok: true, recorded: { dimension, score, notes: notes || null } };
}

async function handleStoreSurveyResults({ surveyActionId, scores }, { userId }) {
  const action = await getOpenSurveyAction(null, userId);

  await createSurveyResponse(surveyActionId, {
    _userId: userId,
    surveyDefinitionId: action ? action.surveyDefinitionId : null,
    surveyActionId,
    type: 'weekly',
    scores: scores.map(s => ({
      dimension: s.dimension,
      average: s.score,
      score: s.score,
      notes: s.notes || null
    }))
  });

  await markActionCompleted(surveyActionId);

  return {
    success: true,
    summary: scores.map(s => ({ dimension: s.dimension, score: s.score })),
    message: 'Survey results saved successfully.'
  };
}

async function handleAbandonSurvey({ surveyActionId, reason }, { userId }) {
  // Do not mark completed — leave action open for next session
  return { ok: true, abandoned: true, reason: reason || 'User requested to stop.' };
}

async function handleSurveyTool(toolName, toolInput, context) {
  switch (toolName) {
    case 'start_survey':        return handleStartSurvey(toolInput, context);
    case 'submit_survey_answer': return handleSubmitAnswer(toolInput, context);
    case 'store_survey_results': return handleStoreSurveyResults(toolInput, context);
    case 'abandon_survey':      return handleAbandonSurvey(toolInput, context);
    default: return { error: `Unknown survey tool: ${toolName}` };
  }
}

const SURVEY_TOOL_NAMES = ['start_survey', 'submit_survey_answer', 'store_survey_results', 'abandon_survey'];

module.exports = { handleSurveyTool, SURVEY_TOOL_NAMES };
```

### 4. Update `packages/survey-engine/index.cjs`

Add exports at the bottom:

```javascript
// Tool-based sub-agent API
const { surveyTools } = require('./src/tools/schema.cjs');
const { handleSurveyTool, SURVEY_TOOL_NAMES } = require('./src/tools/handlers.cjs');

module.exports = {
  // ... existing exports unchanged ...
  surveyTools,
  handleSurveyTool,
  SURVEY_TOOL_NAMES
};
```

---

## Important Notes

- `handleSubmitAnswer` does NOT persist to DB — it's a per-question acknowledgement so the client gets `tool_complete` events showing progress. Actual persistence happens in `handleStoreSurveyResults`.
- The `getOpenSurveyAction` in handlers takes `(defId, userId)` — pass `null` for defId if surveyActionId is known, or look up by surveyActionId directly. Adjust based on actual db-core query available.
- Check the actual `packages/survey-engine/index.cjs` exports before writing — add only what's missing, don't duplicate.

---

## Acceptance Criteria

- `require('@habitualos/survey-engine').surveyTools` returns array of 4 tool definitions
- `require('@habitualos/survey-engine').handleSurveyTool('start_survey', {...}, {userId})` returns object with `questions` and `instructions`
- `require('@habitualos/survey-engine').handleSurveyTool('store_survey_results', {...}, {userId})` creates a survey response in Firestore and marks the action completed
- No existing survey-engine functionality broken
