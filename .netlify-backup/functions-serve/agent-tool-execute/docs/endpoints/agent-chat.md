# POST /api/agent-chat

Conversational interface for agents to generate deliverables (assets and actions).

## Request

```javascript
{
  userId: "u-{timestamp}-{random}",  // Required
  agentId: "agent-{random}",         // Required
  message: string,                    // Required - user's message
  chatHistory: [{                     // Optional - previous messages
    role: "user" | "assistant",
    content: string
  }],
  actionContext: {                    // Optional - from chat button click
    actionId: string,
    title: string,
    description: string,
    taskType: string,
    taskConfig: object,
    content: string | null,           // For manual actions
    type: string | null,              // Content type (markdown, code, etc.)
    priority: string,
    state: string
  }
}
```

## Response

### Success (200) - Regular Conversation

```javascript
{
  success: true,
  response: string,         // Agent's text response
  actionsGenerated: false
}
```

### Success (200) - Draft Action Generated

```javascript
{
  success: true,
  response: string,
  draftActions: [{
    id: "draft-{timestamp}-{random}",
    title: string,
    description: string,
    priority: "low"|"medium"|"high",
    taskType: "scheduled"|"manual",
    taskConfig: object,
    content: string | null,    // For manual/asset actions
    type: string | null,       // For manual/asset actions
    state: "draft",
    agentId: string
  }],
  hasDraftActions: true
}
```

### Success (200) - Measurement Recorded

```javascript
{
  success: true,
  response: string,
  hasMeasurement: true,
  measurementData: {
    dimensions: [{ name: string, score: number, notes: string | null }],
    notes: string | null
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

1. Validates userId and agentId
2. Fetches agent definition from Firestore
3. Fetches open actions for the agent (states: defined, scheduled, in_progress)
4. Loads architecture docs for agent context
5. Builds system prompt with caching:
   - Block 1: Per-message action context (uncached)
   - Block 2: System prompt + agent overview (cached)
   - Block 3: Open actions list (cached per session)
6. Calls Claude API with tools enabled
7. Handles tool calls if present (makes follow-up call with results)
8. Parses response for signals (GENERATE_ACTIONS, GENERATE_ASSET, STORE_MEASUREMENT)
9. Returns response + extracted signal/data

## Tools

The agent has access to these tools:

### get_action_details

Retrieve full details of a specific action.

```javascript
// Input
{ action_id: "action-{timestamp}-{random}" }

// Output
{
  success: true,
  action: {
    id, title, description, state, priority, taskType,
    taskConfig, content, type, _createdAt, _updatedAt
  }
}
```

### update_action

Update an existing action's metadata.

```javascript
// Input
{
  action_id: "action-{timestamp}-{random}",
  updates: {
    title?: string,
    description?: string,
    priority?: "low"|"medium"|"high",
    taskConfig?: {
      instructions?: string,
      expectedOutput?: string
    }
  }
}

// Output
{
  success: true,
  message: "Updated action: title, description",
  updatedFields: ["title", "description"]
}
```

## Signals

**GENERATE_ACTIONS**: Agent has drafted an action for scheduling
- Parses JSON action definition from response
- Returns as draft (state: "draft") for frontend review
- User can refine or define to persist

**GENERATE_ASSET**: Agent has created an immediate deliverable
- Returns as draft action with taskType: "manual"
- Full content included in response
- User can copy, view, or save

**STORE_MEASUREMENT**: Agent completed a measurement check-in
- Returns dimensions array with scores
- Frontend handles persistence via measurement-create endpoint
- Triggers action completion

## Caching Strategy

Uses Anthropic's prompt caching to reduce token costs:
- First message: Cache miss, creates cache with actions snapshot
- Subsequent messages: Cache hit, reuses snapshot
- Session ends (action created/updated) → next session starts fresh

## Related Files

- Handler: `netlify/functions/agent-chat.js`
- Service: `netlify/functions/_services/db-actions.cjs`
- Frontend: `src/scripts/agent.js`
- Modal: `src/assets/js/components/action-modal.js`
