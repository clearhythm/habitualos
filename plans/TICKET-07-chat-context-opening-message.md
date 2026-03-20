# TICKET-07: Chat Context — Priority-Aware Opening Messages

**Phase**: New pattern (run after TICKET-06 is confirmed working)
**Apps affected**: obi-wai-web (immediate), all chat apps (future)
**Prerequisites**: TICKET-00 (survey-engine with tool API)

---

## Goal

Replace hardcoded opening messages in chat UIs with a lightweight priority-context system. A cheap server-side check (DB read only, no LLM) determines what — if anything — needs attention at conversation start. The opening message is resolved from an app-defined map with package-level defaults as fallback.

---

## The Problem

obi-wai-web (and likely other apps) show a hardcoded opening message like "What would you like to practice today?" regardless of state. When there's a pending survey, Claude correctly mentions it — but only AFTER the user has already replied to the wrong opener. This creates an awkward extra step.

The fix must not trigger an LLM call on page load.

---

## Concept

```
page loads (empty history)
  → client calls /api/chat-context (cheap DB read)
  → returns { priority: 'survey' | null, data: {...} }
  → client resolves opening message from priority map
  → shows message without any LLM call
```

Priority is a queue — first check that matches wins. Apps register their checks. New priority types (onboarding, partner-reply, etc.) are just new check functions added to the queue.

---

## Part 1: Package Work — `packages/survey-engine`

### Add `checkPendingSurvey(surveyDefinitionId)` export

This is a check function factory — returns an async function that can be slotted into a priority queue:

```javascript
// packages/survey-engine/src/context-checks.cjs

function checkPendingSurvey(surveyDefinitionId) {
  return async function(userId) {
    const { getOpenSurveyAction } = require('../survey-actions.cjs');
    const action = await getOpenSurveyAction(surveyDefinitionId, userId);
    if (!action) return null;
    return {
      priority: 'survey',
      data: { surveyActionId: action.id }
    };
  };
}

module.exports = { checkPendingSurvey };
```

Export from `packages/survey-engine/index.cjs`:
```javascript
const { checkPendingSurvey } = require('./src/context-checks.cjs');
// add to module.exports
```

---

## Part 2: Package Work — `packages/frontend-utils`

### Add `resolveChatContext` (server-side) and `resolveOpeningMessage` (client-side)

Check if `packages/frontend-utils` already has an `index.cjs` or similar entry point. Add to it (or create if needed):

**`packages/frontend-utils/src/chat-context.cjs`** — server-side context resolver:

```javascript
// Runs priority checks in order, returns first match
async function resolveChatContext(userId, checks) {
  for (const check of checks) {
    const result = await check(userId);
    if (result) return result;
  }
  return { priority: null, data: null };
}

module.exports = { resolveChatContext };
```

**`packages/frontend-utils/src/opening-message.cjs`** — default message strings + resolver:

```javascript
const PACKAGE_DEFAULT_MESSAGES = {
  survey: "There's a check-in ready for you. Want to do that first, or dive right in?",
  default: "How can I help you today?"
};

// Resolves opening message: app overrides → package defaults → generic fallback
function resolveOpeningMessage(priority, appMessages = {}) {
  const key = priority || 'default';
  return appMessages[key] || PACKAGE_DEFAULT_MESSAGES[key] || PACKAGE_DEFAULT_MESSAGES.default;
}

module.exports = { resolveOpeningMessage, PACKAGE_DEFAULT_MESSAGES };
```

Export both from `packages/frontend-utils/index.cjs` (check current exports first, add only what's missing).

---

## Part 3: obi-wai-web Implementation

### Create `netlify/functions/chat-context.js`

```javascript
const { resolveChatContext } = require('@habitualos/frontend-utils');
const { checkPendingSurvey } = require('@habitualos/survey-engine');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405 };

  const { userId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const context = await resolveChatContext(userId, [
    checkPendingSurvey('survey-obi-v1'),
    // future checks go here
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context)
  };
};
```

### Update `src/practice/chat.njk`

**Replace** the hardcoded opening message block (currently lines ~335-343):

```javascript
// Before
if (chatHistory.length === 0) {
  const openingMessage = {
    role: 'assistant',
    content: "What would you like to practice today?",
    timestamp: new Date().toISOString()
  };
  chatHistory.push(openingMessage);
  saveChatHistory(chatHistory);
}
```

**With** a context-aware version:

```javascript
const APP_MESSAGES = {
  survey: "Before we get going — there's a quick check-in waiting. Want to do that first, or just get to it?",
  default: "What would you like to practice today?"
};

if (chatHistory.length === 0) {
  let openingContent = APP_MESSAGES.default;
  try {
    const ctx = await fetch(`/.netlify/functions/chat-context?userId=${encodeURIComponent(userId)}`).then(r => r.json());
    if (ctx.priority && APP_MESSAGES[ctx.priority]) {
      openingContent = APP_MESSAGES[ctx.priority];
    } else if (ctx.priority) {
      // Package default for known priorities the app hasn't customized
      const PACKAGE_DEFAULTS = {
        survey: "There's a check-in ready for you. Want to do that first, or dive right in?"
      };
      openingContent = PACKAGE_DEFAULTS[ctx.priority] || APP_MESSAGES.default;
    }
  } catch (e) {
    // Silently fall back to default on error
  }

  const openingMessage = {
    role: 'assistant',
    content: openingContent,
    timestamp: new Date().toISOString()
  };
  chatHistory.push(openingMessage);
  saveChatHistory(chatHistory);
}
```

Note: this fetch only runs when `chatHistory.length === 0` (first visit or cleared history). Returning visits render from localStorage with no network call.

---

## Important Notes

- This is a GET endpoint, not POST — no body, userId via query param. Verify Netlify function routing supports GET (it does).
- Read `packages/frontend-utils/index.cjs` before editing — don't duplicate or break existing exports.
- The `resolveChatContext` helper on the server and `resolveOpeningMessage` helper on the client are thin utilities. If `frontend-utils` has a different structure, adapt accordingly rather than forcing the file layout.
- Future apps adding surveys just need: (1) create their own `chat-context.js` endpoint with `checkPendingSurvey('their-survey-id')` in the queue, (2) add `APP_MESSAGES.survey` string to their chat template.
- Future priority types (onboarding, partner-reply, etc.) are just new check functions imported from the relevant package and added to the queue array.

---

## Acceptance Criteria

- First visit with pending survey: opening message is the survey-aware string. User doesn't have to reply before being invited to take the survey.
- First visit without pending survey: opening message is the normal default string.
- Returning visit (history in localStorage): no network call at all, history renders from cache as before.
- Network error on context fetch: silently falls back to default opening message.
- No LLM API call triggered on page load.
