# Discovery Pipeline — Phase 5: Chat-Based Draft Review

## Context

HabitualOS is a personal agentic system built on Netlify serverless functions (Node.js, CommonJS), 11ty static site generator (Nunjucks templates), and Google Firestore. We are building a company discovery pipeline.

**Prerequisites:** Phases 1 and 2 must be complete. The `agent-drafts` and `user-feedback` collections, services, and endpoints must exist.

This phase adds chat-based review of agent drafts. When an agent creates content drafts (companies, people, articles), the user reviews them through a conversational interface — not a form or modal. This follows the same pattern as measurement check-ins, where clicking an action redirects to agent chat with context.

## Architecture Overview

**Two concepts working together:**
- **Drafts** = content agents produce (stored in `agent-drafts` Firestore collection). Content layer.
- **Actions** = workflow triggers (stored in `actions` collection). Already exists.

**The review flow:**
1. Drafts are created in `agent-drafts` (by discovery pipeline or manually)
2. ONE review Action is created: "Review latest company recommendations" (taskType: "review")
3. User clicks the review action in their action queue
4. Action redirects to agent chat with review context (sessionStorage pattern)
5. Agent chat endpoint detects review context, fetches pending drafts, injects into system prompt
6. Agent presents companies conversationally
7. User discusses naturally: "I like the first one, not interested in the second..."
8. Agent uses `submit_draft_review` tool to store structured feedback per draft
9. When done, agent completes the review action

## Key Existing Patterns to Follow

### Measurement Action Pattern (in `src/assets/js/components/action-card.js`)

```javascript
// This is how measurement actions work — review actions should follow the same pattern
export function isMeasurementAction(action) {
  return action.taskType === 'measurement' && action.state !== 'completed' && action.state !== 'dismissed' && action.agentId;
}

export function handleMeasurementClick(action) {
  sessionStorage.setItem('measurementActionContext', JSON.stringify({
    actionId: action.id,
    title: action.title,
    taskType: action.taskType,
    taskConfig: action.taskConfig
  }));
  window.location.href = `/do/agent/?id=${action.agentId}#chat`;
}
```

### Agent Chat Context Pattern (in `netlify/functions/agent-chat.js`)

The agent-chat.js endpoint accepts an `actionContext` in the request body. When present, it's used to build context-specific system prompt blocks. Review context should follow this same pattern.

### Conditional Tools Pattern (in `netlify/functions/agent-chat.js`)

Tools like filesystem (read_file, write_file, list_files) and notes (create_note, get_notes, update_note) are conditionally registered based on agent capabilities and environment. Review tools should be conditionally registered when review context is present.

## Implementation

### Review Action Schema

When creating a review action (done manually for now, automated by discovery pipeline later):

```javascript
{
  title: "Review latest company recommendations",
  description: "3 new companies to review",
  taskType: "review",           // NEW type
  assignedTo: "user",
  state: "open",
  priority: "medium",
  agentId: "agent-...",
  _userId: "u-...",
  taskConfig: {
    draftType: "company"        // what kind of drafts to review
  }
}
```

### New Review Tools for Agent Chat

Two new tools available when review context is detected:

**`get_pending_drafts`**
- Description: "Retrieve pending content drafts for this agent that need user review"
- Input: `{ type?: string }` (optional filter by draft type)
- Effect: Queries `agent-drafts` collection for status="pending", filtered by agentId and userId
- Returns: Array of draft objects with id, type, status, data

**`submit_draft_review`**
- Description: "Submit the user's review feedback for a specific draft"
- Input:
  ```javascript
  {
    draftId: "draft-xxx",       // required
    score: 7,                   // 0-10, required
    feedback: "Great coaching model...", // narrative, required
    status: "accepted",         // "accepted" | "rejected", required
    user_tags: ["coaching"]     // optional array
  }
  ```
- Effect:
  1. Creates a record in `user-feedback` collection via `db-user-feedback.cjs`
  2. Updates the draft's status in `agent-drafts` via `db-agent-drafts.cjs`
- Returns: `{ success: true, feedbackId: "feedback-xxx", draftStatus: "accepted" }`

### System Prompt Addition for Review Context

When review context is present, add a system prompt block like:

```
## Review Context

You are in draft review mode. The user is reviewing content recommendations you've made.

Present each draft naturally in conversation. For each:
- Share the key details (name, what they do, why you recommended them)
- Share your fit score and reasoning
- Ask the user what they think

After the user shares their thoughts on each draft, use the submit_draft_review tool to record their feedback. Extract:
- A score (0-10) based on their expressed interest level
- A summary of their feedback in their own words
- Whether they accept or reject the recommendation
- Any tags they mention or imply

Be conversational, not formulaic. Don't present all drafts at once — go through them one at a time unless the user asks to see them all.

Pending drafts to review:
[JSON of pending drafts injected here]
```

## Files to Create

### `src/assets/js/api/drafts.js`

Minimal frontend API client for testing:

```javascript
export async function createDraft(data) {
  const response = await fetch('/api/agent-drafts-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function listDrafts(userId, agentId, filters = {}) {
  const response = await fetch('/api/agent-drafts-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentId, ...filters })
  });
  return response.json();
}
```

## Files to Modify

### `src/assets/js/components/action-card.js`

1. Add review icon to `getActionIcon()`:
   ```javascript
   const icons = {
     measurement: '📊',
     manual: '📄',
     interactive: '💬',
     review: '🔍',       // ADD THIS
   };
   ```

2. Add review action helpers (following measurement pattern):
   ```javascript
   export function isReviewAction(action) {
     const isReview = action.taskType === 'review';
     const isCompleted = action.state === 'completed' || action.state === 'dismissed';
     return isReview && !isCompleted && action.agentId;
   }

   export function handleReviewClick(action) {
     sessionStorage.setItem('reviewActionContext', JSON.stringify({
       actionId: action.id,
       title: action.title,
       taskType: action.taskType,
       taskConfig: action.taskConfig
     }));
     window.location.href = `/do/agent/?id=${action.agentId}#chat`;
   }
   ```

### `src/scripts/agent.js`

1. Import review helpers from action-card.js
2. In the action click handler, add review action detection (similar to measurement):
   - If `isReviewAction(action)`, call `handleReviewClick(action)` instead of opening modal
3. On chat initialization, check for review context in sessionStorage:
   - Read `reviewActionContext` from sessionStorage
   - If present, include it in chat request as `reviewContext`
   - Clear from sessionStorage after reading (same as measurement pattern)

### `netlify/functions/agent-chat.js` (the main change)

This is the largest file (~44KB). Changes needed:

1. **Import new services** at the top:
   ```javascript
   const { getDraftsByAgent, updateDraftStatus } = require('./_services/db-agent-drafts.cjs');
   const { createFeedback } = require('./_services/db-user-feedback.cjs');
   ```

2. **Detect review context** in the request body:
   ```javascript
   const { userId, agentId, message, chatHistory, actionContext, reviewContext } = JSON.parse(event.body);
   ```

3. **When reviewContext is present:**
   - Fetch pending drafts: `const pendingDrafts = await getDraftsByAgent(agentId, userId, { status: 'pending', type: reviewContext.taskConfig?.draftType })`
   - Add a review-specific system prompt block containing the review instructions and pending draft data (see "System Prompt Addition" above)
   - Register the two review tools (`get_pending_drafts`, `submit_draft_review`) in the tools array

4. **Add tool handlers** in the tool execution section:
   - `get_pending_drafts`: Call `getDraftsByAgent` with filters, return results
   - `submit_draft_review`: Call `createFeedback` with the structured data, call `updateDraftStatus` to update the draft, return confirmation

5. **Tool definitions** (add to tools array when review context present):
   ```javascript
   {
     name: "get_pending_drafts",
     description: "Retrieve pending content drafts for this agent that need user review",
     input_schema: {
       type: "object",
       properties: {
         type: { type: "string", description: "Filter by draft type (e.g., 'company')" }
       }
     }
   },
   {
     name: "submit_draft_review",
     description: "Submit the user's review feedback for a specific content draft",
     input_schema: {
       type: "object",
       properties: {
         draftId: { type: "string", description: "The draft ID to review" },
         score: { type: "number", description: "User's fit score 0-10" },
         feedback: { type: "string", description: "User's narrative feedback" },
         status: { type: "string", enum: ["accepted", "rejected"], description: "Accept or reject" },
         user_tags: { type: "array", items: { type: "string" }, description: "Optional user-applied tags" }
       },
       required: ["draftId", "score", "feedback", "status"]
     }
   }
   ```

## Verification

### Setup (create test data):

Use curl or the frontend API to create test drafts and a review action for the careerlaunch agent. You'll need the actual userId and agentId from the running system.

```bash
# Create 3 test drafts
curl -X POST localhost:8888/api/agent-drafts-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","agentId":"AGENT_ID","type":"company","data":{"name":"Spring Health","domain":"springhealth.com","stage":"series-e","employee_band":"500-1000","agent_recommendation":"Hybrid therapy/coaching model with deep personalization","agent_fit_score":8,"agent_tags":["healthtech","mental-health"]}}'

curl -X POST localhost:8888/api/agent-drafts-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","agentId":"AGENT_ID","type":"company","data":{"name":"Calm","domain":"calm.com","stage":"series-c+","employee_band":"500-1000","agent_recommendation":"Leading meditation app, strong brand, expanding into B2B wellness","agent_fit_score":7,"agent_tags":["mental-health","wellness","b2c"]}}'

curl -X POST localhost:8888/api/agent-drafts-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","agentId":"AGENT_ID","type":"company","data":{"name":"Kintsugi","domain":"kintsugi.com","stage":"series-a","employee_band":"11-50","agent_recommendation":"Voice biomarker AI for mental health screening. Novel technology, early stage.","agent_fit_score":6,"agent_tags":["healthtech","ai","mental-health"]}}'

# Create 1 review action (use the action-generate or action-define endpoint, or create manually in Firestore)
```

### Test flow:
1. Load agent detail page → Actions view
2. See the review action in queue (blue bar, 🔍 icon)
3. Click review action → redirects to agent chat
4. Agent should present the 3 companies conversationally
5. Discuss: "I like Spring Health, not sure about Calm, Kintsugi is too small"
6. Agent should use `submit_draft_review` tool for each
7. Check Firestore: 3 feedback records created, 3 draft statuses updated
8. Review action should be completed
