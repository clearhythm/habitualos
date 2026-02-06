# Discovery Pipeline — Phase 2: Firestore Drafts + Feedback Services & Endpoints

## Context

HabitualOS is a personal agentic system built on Netlify serverless functions (Node.js, CommonJS), 11ty static site, and Google Firestore. We are building a company discovery pipeline.

This phase creates two new Firestore collections and their service layers + API endpoints:
- `agent-drafts` — content agents produce for user review (companies, people, articles)
- `user-feedback` — structured feedback from user review sessions (score + narrative)

## Architecture Patterns to Follow

All services follow the pattern in `netlify/functions/_services/db-agent-notes.cjs`:
- Import `dbCore` from `./db-core.cjs`
- Import ID generator from `../_utils/data-utils.cjs`
- Header comment block with responsibilities and schema
- Each function uses `dbCore.create()`, `dbCore.get()`, `dbCore.query()`, `dbCore.patch()`, `dbCore.remove()`
- Filtering by `_userId` for security done in JS after query

All endpoints follow the pattern in `netlify/functions/agent-notes-create.js`:
- `require('dotenv').config()` at top
- Import from service layer
- Validate HTTP method (POST)
- Parse JSON body
- Validate `userId` (must start with `u-`)
- Validate required fields
- Call service function
- Return `{ success: true, ... }` or `{ success: false, error: "..." }`

ID generation follows the pattern in `netlify/functions/_utils/data-utils.cjs`:
- Uses `uniqueId(prefix)` function which generates `{prefix}-{timestamp36}{random4}`

## New Files to Create

### 1. `netlify/functions/_services/db-agent-drafts.cjs`

```
Collection: "agent-drafts"
ID prefix: "draft-"

Schema:
{
  id: "draft-{timestamp}{random}",
  _userId: "u-...",
  agentId: "agent-...",
  type: "company",              // extensible: company | person | article | job
  status: "pending",            // pending | accepted | rejected | committed
  data: {                       // type-specific payload
    name: "Spring Health",
    domain: "springhealth.com",
    stage: "series-e",
    employee_band: "500-1000",
    agent_recommendation: "...",
    agent_fit_score: 8,
    agent_tags: ["healthtech", "mental-health"],
    links: { website: "...", careers: "..." }
  },
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

Exports:
- `createDraft(data)` — Create draft with generated ID. Required fields: `_userId`, `agentId`, `type`, `data`. Default status: `"pending"`.
- `getDraftById(draftId)` — Get single draft by ID, return null if not found.
- `getDraftsByAgent(agentId, userId, filters?)` — Get drafts for agent, filtered by userId. Optional filters: `{ status?, type?, limit? }`. Sort by `_createdAt` descending.
- `updateDraft(draftId, updates)` — Update allowed fields: `status`, `data`. Whitelist fields like `db-agent-notes.cjs` does.
- `updateDraftStatus(draftId, status)` — Convenience method, calls `updateDraft` with just status.

### 2. `netlify/functions/_services/db-user-feedback.cjs`

```
Collection: "user-feedback"
ID prefix: "fb-"

Schema:
{
  id: "fb-{timestamp}{random}",
  _userId: "u-...",
  agentId: "agent-...",
  draftId: "draft-...",
  type: "company",              // matches draft type
  score: 7,                     // 0-10, user's fit assessment
  feedback: "Love the coaching angle, but concerned about...",
  status: "accepted",           // accepted | rejected
  user_tags: ["coaching", "right-size"],
  _createdAt: Timestamp
}
```

Exports:
- `createFeedback(data)` — Create feedback with generated ID. Required: `_userId`, `agentId`, `draftId`, `type`. Optional: `score`, `feedback`, `status`, `user_tags`.
- `getFeedbackByDraft(draftId, userId)` — Get feedback for a specific draft. Return single record or null.
- `getFeedbackByAgent(agentId, userId, limit?)` — Get all feedback for an agent. Sort by `_createdAt` descending.

### 3. `netlify/functions/agent-drafts-create.js`

POST endpoint. Required body fields: `userId`, `agentId`, `type`, `data`. The `data` field is a flexible object (type-specific payload). Returns `{ success: true, draft: { id, ... } }`.

### 4. `netlify/functions/agent-drafts-list.js`

POST endpoint. Required: `userId`, `agentId`. Optional: `status`, `type`, `limit`. Returns `{ success: true, drafts: [...] }`.

### 5. `netlify/functions/agent-drafts-update.js`

POST endpoint. Required: `userId`, `draftId`. Optional: `status`, `data`. Verify draft exists and belongs to user before updating. Returns `{ success: true, result: { id, updated: [...] } }`.

### 6. `netlify/functions/user-feedback-create.js`

POST endpoint. Required: `userId`, `agentId`, `draftId`, `type`. Optional: `score`, `feedback`, `status`, `user_tags`. Returns `{ success: true, feedback: { id, ... } }`.

### 7. `netlify/functions/user-feedback-list.js`

POST endpoint. Required: `userId`, `agentId`. Optional: `limit`. Returns `{ success: true, feedback: [...] }`.

## Files to Modify

### `netlify/functions/_utils/data-utils.cjs`

Add two new ID generators following the existing pattern:

```javascript
function generateDraftId() {
  return uniqueId('draft');
}

function generateFeedbackId() {
  return uniqueId('fb');
}
```

Add both to the `module.exports` object (maintain alphabetical order).

## Verification

Test with curl against local dev server (`localhost:8888` or wherever Netlify Dev runs):

```bash
# Create a draft
curl -X POST localhost:8888/api/agent-drafts-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","agentId":"agent-mk3jq2dqjbfy","type":"company","data":{"name":"Spring Health","domain":"springhealth.com","stage":"series-e","employee_band":"500-1000","agent_recommendation":"Hybrid therapy model with deep personalization","agent_fit_score":8,"agent_tags":["healthtech","mental-health"]}}'

# List pending drafts
curl -X POST localhost:8888/api/agent-drafts-list \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","agentId":"agent-mk3jq2dqjbfy","status":"pending"}'

# Update draft status
curl -X POST localhost:8888/api/agent-drafts-update \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","draftId":"draft-XXXXX","status":"accepted"}'

# Submit feedback
curl -X POST localhost:8888/api/user-feedback-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","agentId":"agent-mk3jq2dqjbfy","draftId":"draft-XXXXX","type":"company","score":7,"feedback":"Love the coaching angle","status":"accepted","user_tags":["coaching"]}'

# List feedback
curl -X POST localhost:8888/api/user-feedback-list \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","agentId":"agent-mk3jq2dqjbfy"}'
```

All endpoints should return `{ success: true, ... }` with appropriate data. Verify records appear in Firestore console.
