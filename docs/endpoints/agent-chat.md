# POST /api/agent-chat

Conversational interface for agents to generate deliverables (assets and actions).

## Request

```javascript
{
  userId: "u-{timestamp}-{random}",  // Required
  agentId: "agent-{random}",         // Required
  message: string,                    // Required - user's message
  conversationHistory: [{             // Optional - previous messages
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
  response: string,  // Agent's text response
  signal: string | null,  // CREATE_ACTION, GENERATE_ASSET, etc.

  // IF signal === "CREATE_ACTION"
  action: {
    title: string,
    description: string,
    priority: "low"|"medium"|"high",
    taskType: "scheduled"|"interactive",
    taskConfig: {
      instructions: string,
      expectedOutput: string,
      context: object
    }
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
3. Loads architecture docs for agent context
4. Calls Claude API with:
   - System prompt (cached) with architecture docs
   - Conversation history
   - Current message
5. Parses response for signals
6. Returns response + extracted signal/data

## Signals

**CREATE_ACTION**: Agent has defined an action ready to be created
- Extracts action fields from response
- Returns structured action object
- Frontend can review/edit before persisting

**GENERATE_ASSET**: Agent has created a draft asset
- Similar to CREATE_ACTION but for immediate deliverables
- Full content included in response

**USE_TOOL: tool_name**: Agent requests tool execution
- Currently supports: `sync_documentation`
- Tool execution happens server-side

## Agent Chat Persistence

When action/asset is finalized:
- Creates or appends to `agent-chats` collection
- Stores full conversation history
- Links generated asset/action IDs
- Used for audit trail and debugging

## Related Files

- Handler: [netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)
- Service: [netlify/functions/_services/db-agent-chats.cjs](netlify/functions/_services/db-agent-chats.cjs)
- Frontend: [src/do/agent.njk](src/do/agent.njk)
