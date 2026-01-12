# POST /api/action-define

Persist a draft action to Firestore (transition from "draft" to "defined" state).

## Request

```javascript
{
  userId: "u-{timestamp}-{random}",  // Required
  agentId: "agent-{random}",         // Required
  title: string,                      // Required
  description: string,                // Required
  priority: "low"|"medium"|"high",   // Optional (default: "medium")
  taskType: "scheduled"|"interactive", // Optional (default: "scheduled")
  taskConfig: {                       // Optional (default: {})
    instructions: string,
    expectedOutput: string,
    context: object
  }
}
```

## Response

### Success (200)

```javascript
{
  success: true,
  action: {
    id: "action-{timestamp}-{random}",
    _userId: "u-{timestamp}-{random}",
    agentId: "agent-{random}",
    title: string,
    description: string,
    state: "defined",  // Always "defined" after this call
    priority: string,
    taskType: string,
    taskConfig: object,
    scheduleTime: null,
    startedAt: null,
    completedAt: null,
    dismissedAt: null,
    dismissedReason: null,
    errorMessage: null,
    _createdAt: Timestamp
  }
}
```

### Error (400, 404, 500)

```javascript
{
  success: false,
  error: string
}
```

## Behavior

1. Validates userId format (`u-*`)
2. Validates required fields (agentId, title, description)
3. Verifies agent exists and user owns it
4. Generates action ID: `action-{timestamp}-{random}`
5. Creates action document in `actions` collection with state="defined"
6. Fetches and returns created action

## State Transitions

```
Draft (localStorage)
  → [action-define] →
Defined (Firestore, ready for scheduling)
  → [scheduler] →
Scheduled → In Progress → Completed
```

## Related Files

- Handler: [netlify/functions/action-define.js](netlify/functions/action-define.js)
- Service: [netlify/functions/_services/db-actions.cjs](netlify/functions/_services/db-actions.cjs)
- Frontend: [src/do/agent.njk](src/do/agent.njk)
