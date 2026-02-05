# POST /api/action-define

Persist a draft action to Firestore (transition from "draft" to "defined" state).

## Request

```javascript
{
  userId: "u-{timestamp}-{random}",    // Required
  agentId: "agent-{random}",           // Required if no projectId
  projectId: "project-{random}",       // Required if no agentId
  title: string,                       // Required
  description: string,                 // Optional (default: "")
  priority: "low"|"medium"|"high",     // Optional (default: "medium")
  taskType: "scheduled"|"interactive"|"manual", // Optional (default: "scheduled")
  dueDate: "YYYY-MM-DD",               // Optional due date
  taskConfig: {                        // Optional (default: {})
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
    agentId: "agent-{random}" | null,
    projectId: "project-{random}" | null,
    title: string,
    description: string,
    state: "open",  // Ready for scheduling
    priority: string,
    taskType: string,
    dueDate: "YYYY-MM-DD" | null,
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
2. Validates required fields (title, and either agentId or projectId)
3. Verifies agent/project exists and user owns it
4. Generates action ID: `action-{timestamp}-{random}`
5. Creates action document in `actions` collection with state="open"
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
