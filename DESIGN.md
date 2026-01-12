---
last_sync: 2026-01-12T19:04:42.011Z
last_commit: 2026-01-12T19:05:43Z
commits_since_sync: 1
---

# HabitualOS Design Documentation

## File Structure

```
habitualos/
├── db/                          # Database layer (deprecated - legacy SQLite, now using Firestore)
│   ├── init.js                  # Legacy DB initialization
│   └── schema.sql               # Legacy schema definitions
│
├── netlify/functions/           # Serverless API endpoints
│   ├── _services/               # Database service layer (Firestore)
│   │   ├── db-agents.cjs        # Agent CRUD operations
│   │   ├── db-actions.cjs       # Action CRUD operations
│   │   ├── db-assets.cjs        # Asset CRUD operations
│   │   ├── db-agent-creation-chats.cjs
│   │   ├── db-agent-chats.cjs   # Work session chat history
│   │   └── db-action-chat-messages.cjs
│   ├── _tools/                  # MCP-adjacent tool registry
│   │   ├── registry.cjs         # Central tool definitions with MCP schemas
│   │   └── sync-documentation.cjs  # Documentation sync tool
│   ├── _utils/                  # Shared utilities
│   │   └── data-utils.cjs       # ID generation, validation
│   ├── agent-*.js               # Agent management endpoints
│   ├── action-*.js              # Action management endpoints
│   ├── setup-chat.js            # Agent creation chat flow
│   ├── agent-chat.js            # Agent conversation interface (includes ARCHITECTURE.md + DESIGN.md, prompt cached)
│   ├── agent-chat-save.js       # Save/append agent chat history
│   └── task-outputs.js          # Task execution results
│
├── scheduler/                   # Background task execution
│   ├── index.js                 # Cron scheduler entry point
│   └── task-executor.js         # Task execution logic
│
├── scripts/                     # Build and automation scripts
│   ├── context-sync.js          # Maintains ARCHITECTURE.md + DESIGN.md from changelog (prompt cached)
│   ├── debug-draft-actions.js   # Debug script for inspecting localStorage draft actions
│   ├── debug-latest-chat.js     # Debug script for inspecting latest agent chat
│   └── update-design-agent.js   # One-time migration script (demo of new goal framing)
│
├── src/                         # Frontend source
│   ├── _includes/               # Nunjucks templates
│   │   ├── base.njk             # Base layout template
│   │   └── nav.njk              # Navigation component
│   ├── assets/js/auth/          # Authentication utilities
│   │   └── auth.js              # Client-side user ID management
│   ├── scripts/                 # Page-specific JavaScript
│   │   └── app.js               # Main application logic
│   ├── styles/                  # Sass stylesheets
│   │   ├── main.scss            # Entry point
│   │   ├── _variables.scss      # Design tokens
│   │   ├── _base.scss           # Base styles
│   │   ├── _layout.scss         # Layout utilities
│   │   ├── _components.scss     # Component styles
│   │   └── _navigation.scss     # Navigation styles
│   ├── do/                      # "Do" section (agents & actions)
│   │   ├── index.njk            # Dashboard
│   │   ├── setup.njk            # Agent creation flow
│   │   ├── agent.njk            # Agent detail page (chat, actions, assets, settings)
│   │   └── action.njk           # Action detail page
│   ├── practice/                # Practice tracking section
│   │   └── index.njk            # Practice dashboard
│   └── index.njk                # Homepage
│
├── data/tasks/                  # Task I/O storage
│   └── {task_id}/
│       ├── inputs/              # User-provided inputs
│       └── outputs/             # Agent-generated outputs
│
├── ARCHITECTURE.md              # High-level system design (living doc with frontmatter)
├── DESIGN.md                    # This file - implementation details (living doc with frontmatter)
└── CHANGELOG_RECENT.md          # Rolling buffer of recent commits
```

## Frontend Design Patterns

### Page Architecture

HabitualOS uses a **hybrid static/SPA approach**:
- Eleventy generates static HTML for each page
- JavaScript progressively enhances with dynamic features
- No heavy frontend framework - vanilla ES6 modules

### Key Frontend Files

#### [/src/scripts/app.js](src/scripts/app.js) (Main Application Logic)
```javascript
// Dashboard rendering
- displayAgents(agents)         // Render agent cards on dashboard
- displayActions(actions)        // Render action cards on dashboard
- filterActions(state)           // Filter actions by state

// Agent detail page
- displayAgentDetail(agent, actions)  // Populate agent page
- loadAgentDetail(agentId)            // Fetch and display agent

// Utilities
- formatDate(isoString)          // Human-readable dates
- formatState(state)             // State badge text
- escapeHtml(str)                // XSS prevention
```

#### [/src/do/agent.njk](src/do/agent.njk) (Agent Detail Page)
Four main views accessed via navigation tabs:
- **Chat View** - Conversational interface with agent
  - Supports "update context" command for manual sync
  - Detects staleness via frontmatter parsing (3+ commits = proactive suggestion)
  - Tool invocation via USE_TOOL signal
  - Manual "Reset Conversation" button beneath chat input
- **Actions View** - Grid of all actions for this agent
- **Assets View** - Grid of all assets for this agent
- **Settings View** - Agent configuration and metrics

Key inline scripts:
- **Chat Lifecycle Management**:
  - `chatHistory` array stores messages in memory
  - `currentChatId` tracks active chat session (null = new, exists = appending)
  - `saveChatToFirestore(mode, deliverableIds)` - CREATE on first deliverable, APPEND on refinements
  - `clearChatHistory()` - Resets chat UI and state, called on approval or manual reset
  - `chatSavedToFirestore` flag removed (replaced by currentChatId tracking)
- **Deliverable Rendering**:
  - Draft action cards (yellow dashed border)
  - Proposed asset cards (blue border)
  - Both rendered inline in chat
- **Deliverable Modals**:
  - Draft action modal with taskConfig fields display (instructions, expectedOutput)
  - Proposed asset modal with full content display
  - Delete buttons (red, left-aligned) to discard unwanted deliverables
  - Action buttons (Define/Save, right-aligned)
- **localStorage Management**:
  - Draft actions: `draft-actions-${agentId}`
  - Proposed assets: `proposed-assets-${agentId}`
  - `deleteDraftAction(draftId)` - Remove from localStorage and DOM
  - `deleteProposedAsset(assetId)` - Remove from localStorage and DOM
- **View Switching**:
  - Tab navigation between Chat/Actions/Assets/Settings
- **Approval Flow**:
  - `markAsDefinedFromModal()` - Saves action to Firestore, clears chat
  - `saveAssetFromModal()` - Saves asset to Firestore, clears chat

#### [/src/do/setup.njk](src/do/setup.njk) (Agent Creation Flow)
Full-screen chat interface for creating agents:
- Opening greeting from AI
- Conversational extraction of goal (framed as "A [type] agent that [does what]"), success criteria, timeline
- Timeline can be specific date/range or "Ongoing" for indefinite agents
- `READY_TO_CREATE` signal detection
- Modal confirmation before agent creation
- Creation overlay with animated progress

#### [/src/_includes/nav.njk](src/_includes/nav.njk) (Navigation Component)
Reusable navigation partial included in base layout:
- Site-wide navigation structure
- Active page highlighting
- Mobile-responsive menu

### Client-Side State Management

#### localStorage Keys
```javascript
// User identity
'habitualos_userId'              // Persisted user ID

// Draft actions (per-agent)
`draft-actions-${agentId}`       // Array of draft action objects

// Proposed assets (per-agent)
`proposed-assets-${agentId}`     // Array of proposed asset objects

// Session state
'habitualos_sessionId'           // Fallback if localStorage unavailable
```

#### Draft Action Object
```javascript
{
  id: 'draft-1234567890-abc123',  // Temporary ID
  title: '2-5 word title',
  description: 'What agent will create',
  priority: 'high|medium|low',
  state: 'draft',                  // Special state
  agentId: 'agent-xyz',
  taskConfig: {                    // For autonomous execution
    instructions: 'Detailed steps',
    expectedOutput: 'What output should include'
  }
}
```

#### Proposed Asset Object
```javascript
{
  id: 'asset-1234567890-abc123',   // Temporary ID
  title: 'Asset title',
  description: 'Brief description',
  content: 'Full content delivered immediately',
  assetType: 'document|code|prompt|email',
  agentId: 'agent-xyz'
}
```

## Backend Design Patterns

### Database Service Layer

All database operations go through service modules in `netlify/functions/_services/`. This provides:
- **Separation of concerns** - Functions don't write raw Firestore queries
- **Consistent error handling** - Services return structured responses
- **User isolation** - All queries automatically filtered by `_userId`

Example service pattern (Firestore):
```javascript
// _services/db-agents.cjs
const { db } = require('../_config/firebase-admin.cjs');

async function getAgent(agentId) {
  const doc = await db.collection('agents').doc(agentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createAgent(id, data) {
  await db.collection('agents').doc(id).set({
    _userId: data._userId,
    name: data.name,
    status: data.status,
    instructions: data.instructions,
    _createdAt: new Date().toISOString(),
    _updatedAt: new Date().toISOString()
  });
  return getAgent(id);
}
```

### Agent Chat History Service

**[netlify/functions/_services/db-agent-chats.cjs](netlify/functions/_services/db-agent-chats.cjs)** - Manages work session chat history:

```javascript
// Create new chat (first deliverable generated)
async function createAgentChat(id, data) {
  await db.collection('agent-chats').doc(id).set({
    _userId: data._userId,
    agentId: data.agentId,
    messages: data.messages || [],
    generatedAssets: data.generatedAssets || [],
    generatedActions: data.generatedActions || [],
    _createdAt: new Date().toISOString(),
    _updatedAt: new Date().toISOString()
  });
}

// Append to existing chat (refinement cycle)
async function appendToAgentChat(chatId, newMessages, assetIds = [], actionIds = []) {
  const chatRef = db.collection('agent-chats').doc(chatId);
  const doc = await chatRef.get();
  const existingData = doc.data();
  
  await chatRef.update({
    messages: [...existingData.messages, ...newMessages],
    generatedAssets: [...new Set([...existingData.generatedAssets, ...assetIds])],
    generatedActions: [...new Set([...existingData.generatedActions, ...actionIds])],
    _updatedAt: new Date().toISOString()
  });
}
```

### API Function Pattern

Standard structure for Netlify Functions:

```javascript
// netlify/functions/agent-get.js
exports.handler = async (event) => {
  // 1. Validate HTTP method
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // 2. Parse and validate inputs
    const { id, userId } = event.queryStringParameters;
    if (!id || !userId) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing params' }) };
    }

    // 3. Call database service
    const agent = await getAgent(id);

    // 4. Authorization check
    if (!agent || agent._userId !== userId) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Not found' }) };
    }

    // 5. Return success
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, agent })
    };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
```

### LLM Integration Patterns

#### Structured Output Parsing

HabitualOS uses **signal-based parsing** with strict regex matching to detect when LLMs produce structured output. Signals must appear at the start of a line to prevent false matches in explanatory text.

**Agent Creation** ([netlify/functions/setup-chat.js](netlify/functions/setup-chat.js)):
```
User: "I want to launch a SaaS product"
...conversation...
Assistant: "READY_TO_CREATE
---
TITLE: Launch SaaS MVP
GOAL: A product launch agent that...
SUCCESS_CRITERIA: ...
TIMELINE: Ongoing"
```

**Action Generation** ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)):
```
User: "Generate an action for this"
Assistant: "GENERATE_ACTIONS
---
{
  "title": "Market Research Report",
  "description": "Create comprehensive market analysis",
  "priority": "high",
  "taskType": "scheduled",
  "taskConfig": {
    "instructions": "Research competitors, analyze market size...",
    "expectedOutput": "PDF report with executive summary, data tables..."
  }
}"
```

**Asset Generation** ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)):
```
User: "Create a specification document"
Assistant: "GENERATE_ASSET
---
{
  "title": "API Specification Document",
  "description": "Complete REST API specification",
  "assetType": "document",
  "content": "# API Specification\n\n## Endpoints\n\n..."
}"
```

**Tool Invocation** ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)):
```
Assistant: "I'll sync the documentation now.

USE_TOOL: sync_documentation

The documentation has been updated..."
```

Parsing logic (strict regex matching):
1. Check for signal at start of line: `/^GENERATE_ACTIONS\s*\n---/m`, `/^GENERATE_ASSET\s*\n---/m`, `/^USE_TOOL:\s*(\w+)/m`
2. Extract content after `---` delimiter
3. Parse JSON or key-value format
4. Return structured data + conversational confirmation
5. False matches in explanatory text are prevented by line-start requirement

**Asset vs Action Distinction**:
- **ASSET**: Deliver FULL CONTENT immediately (spec docs, code, emails, prompts)
- **ACTION**: Work to be done LATER at scheduled time (recurring posts, scheduled tasks)

System prompt includes explicit guidance:
```
KEY RULE:
- User asks you to CREATE something → GENERATE_ASSET (deliver full content NOW)
- User asks you to SCHEDULE something → GENERATE_ACTIONS (do work LATER)
```

#### Context Injection with Prompt Caching

Agent chat ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)) includes both ARCHITECTURE.md and DESIGN.md in system prompt with ephemeral prompt caching:

```javascript
const architectureContext = fs.readFileSync('ARCHITECTURE.md', 'utf8');
const designContext = fs.readFileSync('DESIGN.md', 'utf8');

// Parse frontmatter to detect staleness
const archFrontmatter = parseFrontmatter(architectureContext);
const commitsSinceSync = archFrontmatter.commits_since_sync || 0;

let stalenessPrompt = '';
if (commitsSinceSync >= 3) {
  stalenessPrompt = `\n\nIMPORTANT: Documentation is ${commitsSinceSync} commits stale. Proactively suggest updating via sync_documentation tool.`;
} else if (commitsSinceSync > 0) {
  stalenessPrompt = `\n\n(Note: Documentation is ${commitsSinceSync} commits behind. Mention casually if relevant.)`;
}

const systemPrompt = [
  {
    type: 'text',
    text: `You're an autonomous agent...`,
    cache_control: { type: 'ephemeral' }  // Cache system instructions
  },
  {
    type: 'text',
    text: `${architectureContext}\n\n${designContext}${stalenessPrompt}`,
    cache_control: { type: 'ephemeral' }  // Cache documentation context
  }
];

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8000,
  system: systemPrompt,
  messages: conversationHistory
});
```

**Prompt Caching Benefits**:
- First call: Full cost (~10k tokens for docs + system prompt)
- Subsequent calls (5-minute window): ~10% cost (~1k tokens for new instructions)
- ~90% cost reduction for conversational chats
- Same caching pattern used in [scripts/context-sync.js](scripts/context-sync.js)

**Staleness Detection**:
- Reads frontmatter: `last_sync`, `last_commit`, `commits_since_sync`
- 3+ commits: Agent proactively suggests sync
- 1-2 commits: Agent mentions casually
- 0 commits: No staleness message

This enables agents to:
- Understand project structure when suggesting deliverables
- Make architecturally-informed recommendations
- Reference specific files/patterns in responses
- Have informed design discussions with users
- Detect documentation staleness and proactively suggest updates
- Operate efficiently with minimal API costs

## Tool Registry System

### [netlify/functions/_tools/registry.cjs](netlify/functions/_tools/registry.cjs)

MCP-adjacent declarative tool definitions:

```javascript
const tools = [
  {
    name: 'sync_documentation',
    description: 'Synchronize architecture and design documentation with recent code changes',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: require('./sync-documentation.cjs').execute
  }
  // Future tools: generate_shift_cards, query_actions, query_assets, etc.
];

function getToolByName(name) {
  return tools.find(tool => tool.name === name);
}

module.exports = { tools, getToolByName };
```

### [netlify/functions/_tools/sync-documentation.cjs](netlify/functions/_tools/sync-documentation.cjs)

Example tool implementation:

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function execute(input) {
  try {
    const { stdout, stderr } = await execPromise('node scripts/context-sync.js');
    return {
      success: true,
      result: 'Documentation synchronized successfully',
      details: { stdout, stderr }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { execute };
```

### Tool Invocation Flow

1. Agent detects need for tool (e.g., staleness >= 3 commits)
2. Agent sends `USE_TOOL: sync_documentation` in response
3. Backend detects signal via regex: `/^USE_TOOL:\s*(\w+)/m`
4. Backend calls `registry.getToolByName(toolName)`
5. Backend executes `tool.handler(parsedInput)`
6. Tool result returned to conversation
7. Agent continues with context of tool execution

## Key Workflows

### 1. Creating an Agent

```
User visits /do/setup/
  ↓
Opening message from AI
  ↓
Conversational back-and-forth
  - What do you want to achieve? (framed as "A [type] agent that [does what]")
  - How will you know it's done?
  - When are you aiming for? (specific date or "Ongoing")
  ↓
AI signals READY_TO_CREATE
  ↓
Modal appears: "Create My Agent"
  ↓
POST /agent-create
  - Saves agent to Firestore
  - Saves creation chat history
  ↓
Redirect to /do/agent/?id={agentId}
```

### 2. Generating Assets (Immediate Deliverables)

```
User chats with agent
  ↓
User: "Create a specification document"
  ↓
POST /agent-chat
  - LLM generates GENERATE_ASSET response
  - Backend parses JSON asset object (includes full content)
  - Returns proposedAsset
  ↓
Frontend receives proposedAsset
  - Saves to localStorage: proposed-assets-${agentId}
  - Renders blue border card inline in chat
  - Creates chat session in Firestore (if first deliverable)
  ↓
User clicks card → Modal opens with full content
  - Delete button (red, left) to discard
  - Save to Assets button (blue, right) to persist
  ↓
User clicks Save to Assets
  - POST to asset save endpoint
  - Persists to Firestore assets collection
  - Clears chat history (UI reset)
  - Removes from localStorage
```

### 3. Generating Actions (Future Deliverables)

```
User chats with agent
  ↓
User: "Generate an action for weekly content"
  ↓
POST /agent-chat
  - LLM generates GENERATE_ACTIONS response
  - Backend parses JSON action object (includes taskConfig)
  - Returns draftAction with state='draft'
  ↓
Frontend receives draftAction
  - Saves to localStorage: draft-actions-${agentId}
  - Renders yellow dashed card inline in chat
  - Creates chat session in Firestore (if first deliverable)
  ↓
User clicks card → Modal opens
  - Shows title, description, priority
  - Shows taskConfig fields (instructions, expectedOutput)
  - Delete button (red, left) to discard
  - Mark as Defined button (blue, right) to persist
  ↓
User clicks Mark as Defined
  - POST /action-define
  - Persists to Firestore actions collection
  - Clears chat history (UI reset)
  - Removes from localStorage
```

### 4. Refinement Cycle

```
Agent generates deliverable (asset or action)
  ↓
Chat saved to Firestore (CREATE mode)
  - currentChatId stored in memory
  - chatHistory persists in localStorage
  ↓
User closes modal without approving
  ↓
User: "Make it more detailed"
  ↓
Agent refines deliverable
  ↓
Chat appended to Firestore (APPEND mode)
  - Same currentChatId
  - New messages added to existing chat document
  - Updated deliverable IDs merged
  ↓
Repeat refinement as needed...
  ↓
User approves (Save/Define button)
  ↓
clearChatHistory() called
  - chatHistory array cleared
  - currentChatId reset to null
  - Chat UI cleared
  - Fresh greeting rendered
  ↓
Next deliverable creates new chat session
```

### 5. Manual Conversation Reset

```
User clicks "Reset Conversation" button
  ↓
Confirmation dialog appears
  ↓
User confirms
  ↓
clearChatHistory() called
  - chatHistory array cleared
  - currentChatId reset to null
  - Chat UI cleared
  - Fresh greeting rendered
  ↓
Draft actions/assets remain in localStorage
  (User can delete manually if needed)
  ↓
Next deliverable creates new chat session
```

### 6. Scheduled Task Execution

```
Cron runs every minute (scheduler/index.js)
  ↓
Query: Firestore actions collection
       WHERE state = 'scheduled'
       AND scheduleTime <= NOW()
  ↓
For each scheduled action:
  - Update state to 'in_progress'
  - Call task executor
  - LLM generates deliverable iteratively using taskConfig
    * taskConfig.instructions: Detailed execution steps
    * taskConfig.expectedOutput: What output should include
  - Save outputs to data/tasks/{id}/outputs/
  - Update state to 'completed'
  ↓
User sees completed action on dashboard
```

### 7. Living Documentation Sync Workflow

```
Developer commits code
  ↓
Git post-commit hook (.git/hooks/post-commit)
  - Appends commit info to CHANGELOG_RECENT.md
  - Updates frontmatter in ARCHITECTURE.md and DESIGN.md:
    * Increments commits_since_sync
    * Updates last_commit timestamp
  ↓
Next agent chat (agent-chat.js)
  - Reads frontmatter from both docs
  - Detects staleness (commits_since_sync)
  - 3+ commits: Adds proactive sync suggestion to system prompt
  - 1-2 commits: Adds casual mention to system prompt
  ↓
Agent autonomously decides to sync (if 3+ commits)
  - Agent: "Documentation is stale. I'll sync it now."
  - Agent sends: USE_TOOL: sync_documentation
  - Backend detects signal, invokes tool
  ↓
sync_documentation tool executes (via registry)
  - Runs: node scripts/context-sync.js
  - Script reads CHANGELOG_RECENT.md
  - Script reads ARCHITECTURE.md + DESIGN.md
  - Calls Claude API (prompt cached):
    * System: "You maintain living architecture documentation..."
    * User: Current docs + recent changelog
  - LLM synthesizes updates to BOTH documents
  - Writes updated ARCHITECTURE.md
  - Writes updated DESIGN.md
  - Updates frontmatter:
    * Sets commits_since_sync = 0
    * Updates last_sync timestamp
  - Clears CHANGELOG_RECENT.md
  ↓
Tool returns success result
  ↓
Agent continues conversation with confirmation
  ↓
Next agent chat uses refreshed documentation context
  ↓
Agent has current understanding of codebase architecture
```

**Manual Sync Options**:
- User types "update context" in agent chat
- User runs: `node scripts/context-sync.js`
- Both trigger same sync workflow

## Styling and UI Patterns

### Design System

**Colors** (from [src/styles/_variables.scss](src/styles/_variables.scss)):
```scss
$color-primary: #2563eb;     // Blue - primary actions
$color-success: #10b981;     // Green - completed states
$color-warning: #f59e0b;     // Amber - in-progress
$color-danger: #ef4444;      // Red - errors/dismissed
$color-muted: #6b7280;       // Gray - secondary text
```

**State Badges**:
- `.badge-open` - Blue (active/scheduled)
- `.badge-completed` - Green (done)
- `.badge-in_progress` - Amber (working)
- `.badge-dismissed` - Red (archived)

**Card Components**:
- `.card` - Standard white card with shadow
- `.card-clickable` - Hover effect for interactive cards
- `.agent-card` - Specialized agent card with metrics
- `.draft-action-card` - Yellow dashed border for draft actions
- `.proposed-asset-card` - Blue border for proposed assets

**Delete Buttons**:
- Red background (#fee2e2)
- Left-aligned in modals
- Confirmation dialog before deletion
- Destructive action styling

### Responsive Patterns

Mobile-first approach:
- Base styles for mobile (< 768px)
- Grid layouts collapse to single column
- Navigation becomes stacked
- Cards stack vertically

Desktop enhancements:
- Multi-column grids for agents/actions/assets
- Side-by-side layouts (settings page)
- Wider max-width containers (700px for chat, full-width for grids)

## Context Sync Implementation Details

### [scripts/context-sync.js](scripts/context-sync.js)

**Purpose**: Maintains living documentation (ARCHITECTURE.md + DESIGN.md) synchronized with codebase changes.

**Key Functions**:
```javascript
async function syncContext() {
  // 1. Read changelog of recent commits
  const changelog = fs.readFileSync('CHANGELOG_RECENT.md', 'utf8');
  
  // 2. Read current documentation
  const architecture = fs.readFileSync('ARCHITECTURE.md', 'utf8');
  const design = fs.readFileSync('DESIGN.md', 'utf8');
  
  // 3. Parse existing frontmatter
  const archFrontmatter = parseFrontmatter(architecture);
  const lastCommit = archFrontmatter.last_commit;
  
  // 4. Call Claude with synthesis prompt (prompt cached)
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200000,
    system: [{
      type: 'text',
      text: 'You maintain living architecture documentation...',
      cache_control: { type: 'ephemeral' }  // Cache instructions
    }],
    messages: [{
      role: 'user',
      content: `Current ARCHITECTURE.md:\n${architecture}\n\n
                Current DESIGN.md:\n${design}\n\n
                Recent changes:\n${changelog}`
    }]
  });
  
  // 5. Parse response (===ARCHITECTURE=== and ===DESIGN=== sections)
  const { architecture: newArch, design: newDesign } = parseResponse(response);
  
  // 6. Update frontmatter
  const now = new Date().toISOString();
  const newArchContent = updateFrontmatter(newArch, {
    last_sync: now,
    last_commit: lastCommit,
    commits_since_sync: 0
  });
  const newDesignContent = updateFrontmatter(newDesign, {
    last_sync: now,
    last_commit: lastCommit,
    commits_since_sync: 0
  });
  
  // 7. Write updated files
  fs.writeFileSync('ARCHITECTURE.md', newArchContent);
  fs.writeFileSync('DESIGN.md', newDesignContent);
  
  // 8. Clear changelog
  fs.writeFileSync('CHANGELOG_RECENT.md', '# Recent Changes\n\n');
}
```

**Output Format**: LLM returns both documents in a parseable format:
```
===ARCHITECTURE===
[updated ARCHITECTURE.md content]
===DESIGN===
[updated DESIGN.md content]
```

**Frontmatter Management**:
```yaml
---
last_sync: 2026-01-11T06:19:18Z      # When docs were last synced
last_commit: 2026-01-12T19:05:43Z
commits_since_sync: 1
---
```

**Post-Commit Hook** (`.git/hooks/post-commit`):
- Appends commit info to CHANGELOG_RECENT.md
- Increments `commits_since_sync` in both docs
- Updates `last_commit` timestamp in both docs

## Debug Scripts

### [scripts/debug-draft-actions.js](scripts/debug-draft-actions.js)
Inspects localStorage draft actions for a specific agent:
```bash
node scripts/debug-draft-actions.js <agentId>
```
Useful for debugging draft action persistence issues.

### [scripts/debug-latest-chat.js](scripts/debug-latest-chat.js)
Fetches and displays the most recent agent chat from Firestore:
```bash
node scripts/debug-latest-chat.js <userId>
```
Useful for debugging chat history persistence and refinement cycles.