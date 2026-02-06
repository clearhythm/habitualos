# POST /api/agent-create

Create a new agent and optionally save the creation chat history.

## Request

```javascript
{
  userId: "u-{timestamp}-{random}",  // Required
  name: string,                       // Required - agent name
  goal: string,                       // Required - agent's main goal
  success_criteria: string[],         // Optional (default: [])
  timeline: string | null,            // Optional (default: null)
  type: "northstar",                  // Optional (default: "northstar")
  chatHistory: [{                     // Optional - agent creation conversation
    role: "user" | "assistant",
    content: string
  }]
}
```

## Response

### Success (200)

```javascript
{
  success: true,
  agent: {
    id: "agent-{random}",
    name: string,
    goal: string,
    success_criteria: string[],
    timeline: string | null,
    type: "northstar"
  }
}
```

### Error (400, 405, 500)

```javascript
{
  success: false,
  error: string
}
```

## Behavior

1. Validates HTTP method is POST (405 if not)
2. Validates userId format (`u-*`) and required fields (name, goal)
3. Generates agent ID: `agent-{random}`
4. Creates agent document in `agents` collection with:
   - _userId for query filtering
   - type (defaults to "northstar")
   - status set to "active"
   - instructions object with goal, success_criteria, timeline, format
5. If chatHistory provided, creates agent creation chat record:
   - Generates chat ID: `agentCreationChat-{random}`
   - Stores in `agent-creation-chats` collection
   - Links to created agent via agentId
6. Returns success response with agent summary

## Agent Creation Chat

The optional chatHistory parameter preserves the conversation that led to the agent's creation. This is useful for:
- Audit trail of how agent requirements were defined
- Context for future agent modifications
- Debugging agent behavior based on original intent

## Related Files

- Handler: [netlify/functions/agent-create.js](netlify/functions/agent-create.js)
- Services:
  - [netlify/functions/_services/db-agents.cjs](netlify/functions/_services/db-agents.cjs)
  - [netlify/functions/_services/db-agent-creation-chats.cjs](netlify/functions/_services/db-agent-creation-chats.cjs)
- Frontend: [src/do/setup.njk](src/do/setup.njk)
