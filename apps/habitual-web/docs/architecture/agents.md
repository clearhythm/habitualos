# Agent System Architecture

## Core Concepts

### Agents
Autonomous AI assistants tied to a specific goal. Each agent:
- Has a **North Star goal** (what the agent IS and DOES)
  - Example: "A strategic architecture agent that generates prompts"
- Has **success criteria** (how you'll know it's done)
- Has a **timeline** (target date or "Ongoing" for indefinite agents)
- Generates **deliverables** (assets and actions)
- Maintains **conversational context** about your goal
- Can use **tools** (sync documentation, etc.)

### Assets
Immediate deliverables with full content delivered NOW:
- Specification documents
- Code snippets
- Email drafts
- Design documents
- Stored as **Proposed** state in localStorage until user saves
- Full content included in generation response

### Actions
Future work to be done LATER at a scheduled time:
- **Draft** - Generated but not finalized (localStorage)
- **Defined** - Finalized and persisted (database, ready for scheduling)
- **Scheduled** - Queued for autonomous execution at specific time
- **In Progress** - Currently being executed
- **Completed** - Work done, artifacts created

Actions include **taskConfig** for autonomous execution:
```javascript
{
  instructions: "Detailed steps for execution",
  expectedOutput: "What artifacts should be produced",
  context: {} // Any additional data needed
}
```

### Agent Chats
Persistent conversation history tracking deliverable generation:
- **Lifecycle**: Created on first deliverable, appended during refinements, cleared on approval
- **Stored**: Full message history, generated asset IDs, generated action IDs
- **Purpose**: Audit trail, refinement context, debugging

**Data structure**:
```javascript
{
  id: "agent-chat-{random}",
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  messages: [{ role, content, timestamp }],
  generatedAssetIds: ["asset-{random}"],
  generatedActionIds: ["action-{timestamp}-{random}"],
  _createdAt: Timestamp
}
```

## Agent Signals

Agents communicate intent via structured responses:

**CREATE_ACTION** - Agent ready to create an action
```
Signal: CREATE_ACTION
Title: [action title]
Description: [description]
... (other fields)
```

**GENERATE_ASSET** - Agent wants to create a draft asset card
```
Signal: GENERATE_ASSET
Title: [asset title]
Type: [document|code|etc]
... (content)
```

**GENERATE_ACTIONS** - Agent wants to create multiple action suggestions
```
Signal: GENERATE_ACTIONS
[Array of action objects]
```

**USE_TOOL** - Agent requests tool execution (e.g., sync documentation)
```
Signal: USE_TOOL: sync_documentation
```

## Tool Registry System

MCP-adjacent declarative tool system for agent capabilities:
- **Registry**: Central tool definitions with MCP-compatible schemas
  - Location: [netlify/functions/_tools/registry.cjs](netlify/functions/_tools/registry.cjs)
- **Tools**: Modules exporting `execute(input)` functions
  - Example: [netlify/functions/_tools/sync-documentation.cjs](netlify/functions/_tools/sync-documentation.cjs)
- **Signal Detection**: Agents use `USE_TOOL: tool_name` format
- **Future-proof**: Can become actual MCP server when needed

## Data Flow

### Creating an Agent
```
User starts chat
  ↓
POST /api/agent-create-chat (initial message)
  ↓
Claude generates goal, criteria, timeline
  ↓
Agent data persisted to Firestore
  ↓
Return agent ID + confirmation
```

### Generating a Deliverable
```
User chats with agent
  ↓
POST /api/agent-chat
  ↓
Claude detects signal (CREATE_ACTION, GENERATE_ASSET, etc.)
  ↓
IF draft: Return to user for refinement
IF approved: Persist to Firestore + create/append agent-chat record
  ↓
Clear localStorage, show success
```

### Autonomous Execution
```
Scheduled action time reached
  ↓
Scheduler picks up action (state: scheduled → in_progress)
  ↓
POST /api/action-execute
  ↓
Claude executes task using taskConfig
  ↓
Artifacts created (documents, code, etc.)
  ↓
Action marked completed, artifacts linked
```

## Database Collections

### agents
```javascript
{
  id: "agent-{random}",
  _userId: "u-{timestamp}-{random}",
  goal: string,
  successCriteria: string,
  timeline: string,
  _createdAt: Timestamp
}
```

### actions
```javascript
{
  id: "action-{timestamp}-{random}",
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  title: string,
  description: string,
  state: "draft|defined|scheduled|in_progress|completed|dismissed",
  priority: "low|medium|high",
  taskType: "scheduled|interactive",
  taskConfig: {
    instructions: string,
    expectedOutput: string,
    context: object
  },
  scheduleTime: string | null,
  startedAt: string | null,
  completedAt: string | null,
  dismissedAt: string | null,
  dismissedReason: string | null,
  errorMessage: string | null,
  _createdAt: Timestamp
}
```

### agent-chats
```javascript
{
  id: "agent-chat-{random}",
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  messages: [{
    role: "user" | "assistant",
    content: string,
    timestamp: string
  }],
  generatedAssetIds: string[],
  generatedActionIds: string[],
  _createdAt: Timestamp
}
```
