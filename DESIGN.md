---
last_sync: 2026-01-09T05:14:52.052Z
last_commit: 2026-01-11T00:56:41Z
commits_since_sync: 14
---

# HabitualOS Design Documentation

## File Structure

```
habitualos/
├── db/                          # Database layer (deprecated - now using Firestore)
│   ├── init.js                  # Legacy DB initialization
│   └── schema.sql               # Legacy schema definitions
│
├── netlify/functions/           # Serverless API endpoints
│   ├── _services/               # Database service layer
│   │   ├── db-agents.cjs        # Agent CRUD operations
│   │   ├── db-actions.cjs       # Action CRUD operations
│   │   ├── db-agent-creation-chats.cjs
│   │   └── db-action-chat-messages.cjs
│   ├── _utils/                  # Shared utilities
│   │   └── data-utils.cjs       # ID generation, validation
│   ├── agent-*.js               # Agent management endpoints
│   ├── action-*.js              # Action management endpoints
│   ├── setup-chat.js            # Agent creation chat flow
│   ├── agent-chat.js            # Agent conversation interface (includes ARCHITECTURE.md + DESIGN.md)
│   └── task-outputs.js          # Task execution results
│
├── scheduler/                   # Background task execution
│   ├── index.js                 # Cron scheduler entry point
│   └── task-executor.js         # Task execution logic
│
├── scripts/                     # Build and automation scripts
│   └── context-sync.js          # Maintains ARCHITECTURE.md + DESIGN.md from changelog
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
│   │   ├── agent.njk            # Agent detail page (chat, actions, settings)
│   │   └── action.njk           # Action detail page
│   └── index.njk                # Homepage
│
├── data/tasks/                  # Task I/O storage
│   └── {task_id}/
│       ├── inputs/              # User-provided inputs
│       └── outputs/             # Agent-generated outputs
│
├── .context-sync-status.json    # Tracks last sync timestamp
├── ARCHITECTURE.md              # High-level system design (living doc)
├── DESIGN.md                    # This file - implementation details (living doc)
├── CHANGELOG_RECENT.md          # Rolling buffer of recent commits
└── SYSTEM.md                    # Legacy context file (deprecated, replaced by ARCHITECTURE + DESIGN)
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
Three main views accessed via navigation tabs:
- **Chat View** - Conversational interface with agent (supports "update context" command)
- **Actions View** - Grid of all actions for this agent
- **Assets View** - Files/artifacts generated (placeholder)
- **Settings View** - Agent configuration and metrics

Key inline scripts:
- Chat message rendering with markdown support
- Draft action card rendering (yellow dashed border)
- Draft action localStorage management
- View switching logic
- Context sync command handling ("update context" in chat)

#### [/src/do/setup.njk](src/do/setup.njk) (Agent Creation Flow)
Full-screen chat interface for creating agents:
- Opening greeting from AI
- Conversational extraction of goal, success criteria, timeline
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
  agentId: 'agent-xyz'
}
```

## Backend Design Patterns

### Database Service Layer

All database operations go through service modules in `netlify/functions/_services/`. This provides:
- **Separation of concerns** - Functions don't write raw SQL
- **Consistent error handling** - Services return structured responses
- **User isolation** - All queries automatically filtered by `_userId`

Example service pattern:
```javascript
// _services/db-agents.cjs
function getAgent(agentId) {
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  const agent = stmt.get(agentId);
  return agent ? { ...agent, instructions: JSON.parse(agent.instructions) } : null;
}

function createAgent(id, data) {
  const stmt = db.prepare(`
    INSERT INTO agents (id, _userId, name, status, instructions, ...)
    VALUES (?, ?, ?, ?, ?, ...)
  `);
  stmt.run(id, data._userId, data.name, ...);
  return getAgent(id);
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

HabitualOS uses **signal-based parsing** to detect when LLMs produce structured output:

**Agent Creation** ([netlify/functions/setup-chat.js](netlify/functions/setup-chat.js)):
```
User: "I want to launch a SaaS product"
...conversation...
Assistant: "READY_TO_CREATE
---
TITLE: Launch SaaS MVP
GOAL: Build and deploy..."
```

**Action Generation** ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)):
```
User: "Generate an action for this"
Assistant: "GENERATE_ACTIONS
---
{
  "title": "Market Research Report",
  "description": "Create comprehensive market analysis",
  "priority": "high"
}"
```

Parsing logic:
1. Check if response includes signal keyword (`READY_TO_CREATE`, `GENERATE_ACTIONS`)
2. Extract content after `---` delimiter
3. Parse JSON or key-value format
4. Return structured data + conversational confirmation

#### Context Injection

Agent chat ([netlify/functions/agent-chat.js](netlify/functions/agent-chat.js)) includes both ARCHITECTURE.md and DESIGN.md in system prompt:

```javascript
const architectureContext = fs.readFileSync('ARCHITECTURE.md', 'utf8');
const designContext = fs.readFileSync('DESIGN.md', 'utf8');

const systemPrompt = `You're an autonomous agent...

${architectureContext ? `
---
## System Architecture
${architectureContext}
` : ''}

${designContext ? `
---
## Implementation Design
${designContext}
` : ''}`;
```

This enables agents to:
- Understand project structure when suggesting deliverables
- Make architecturally-informed recommendations
- Reference specific files/patterns in responses
- Have informed design discussions with users

## Key Workflows

### 1. Creating an Agent

```
User visits /do/setup/
  ↓
Opening message from AI
  ↓
Conversational back-and-forth
  - What do you want to achieve?
  - How will you know it's done?
  - When are you aiming for?
  ↓
AI signals READY_TO_CREATE
  ↓
Modal appears: "Create My Agent"
  ↓
POST /agent-create
  - Saves agent to DB
  - Saves creation chat history
  ↓
Redirect to /do/agent/?id={agentId}
```

### 2. Generating Draft Actions

```
User chats with agent
  ↓
User: "Generate some actions"
  ↓
POST /agent-chat
  - LLM generates GENERATE_ACTIONS response
  - Backend parses JSON action object
  - Returns draftAction with state='draft'
  ↓
Frontend receives draftAction
  - Saves to localStorage
  - Renders yellow dashed card inline in chat
  ↓
User can click card to refine or "Define"
  (Define flow TODO - persists to DB)
```

### 3. Scheduled Task Execution

```
Cron runs every minute (scheduler/index.js)
  ↓
Query: SELECT * FROM actions
       WHERE state = 'scheduled'
       AND scheduleTime <= NOW()
  ↓
For each scheduled action:
  - Update state to 'in_progress'
  - Call task executor
  - LLM generates deliverable iteratively
  - Save outputs to data/tasks/{id}/outputs/
  - Update state to 'completed'
  ↓
User sees completed action on dashboard
```

### 4. Living Documentation Sync Workflow

```
Developer commits code
  ↓
Git post-commit hook (.git/hooks/post-commit)
  - Appends commit info to CHANGELOG_RECENT.md
  - Includes: hash, author, message, changed files
  ↓
User triggers sync:
  - Via agent chat: "update context"
  - Or manually: node scripts/context-sync.js
  ↓
Context sync script (scripts/context-sync.js):
  1. Reads CHANGELOG_RECENT.md
  2. Reads existing ARCHITECTURE.md + DESIGN.md
  3. Calls Claude API with comprehensive synthesis prompt
  4. LLM updates BOTH documents to reflect changes
  5. Writes updated ARCHITECTURE.md
  6. Writes updated DESIGN.md
  7. Updates .context-sync-status.json with timestamp
  8. Clears CHANGELOG_RECENT.md
  ↓
Next agent chat includes updated docs in context
  ↓
Agent has current understanding of codebase architecture
```

**Sync Command in Chat**:
- User types "update context" in agent chat
- Frontend sends POST to /agent-chat with special message
- Backend detects command and triggers context-sync.js
- Returns confirmation message when complete
- Subsequent chats use refreshed documentation

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

### Responsive Patterns

Mobile-first approach:
- Base styles for mobile (< 768px)
- Grid layouts collapse to single column
- Navigation becomes stacked
- Cards stack vertically

Desktop enhancements:
- Multi-column grids for agents/actions
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
  
  // 3. Call Claude with synthesis prompt
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200000,
    system: 'You maintain living architecture documentation...',
    messages: [{
      role: 'user',
      content: `Current ARCHITECTURE.md:\n${architecture}\n\n
                Current DESIGN.md:\n${design}\n\n
                Recent changes:\n${changelog}`
    }]
  });
  
  // 4. Parse response (===ARCHITECTURE=== and ===DESIGN=== sections)
  const { architecture: newArch, design: newDesign } = parseResponse(response);
  
  // 5. Write updated files
  fs.writeFileSync('ARCHITECTURE.md', newArch);
  fs.writeFileSync('DESIGN.md', newDesign);
  
  // 6. Update sync status
  updateSyncStatus();
  
  // 7. Clear changelog
  fs.writeFileSync('CHANGELOG_RECENT.md', '# Recent Changes\n\n');
}
```

**Output Format**: LLM returns both documents in a parseable format:
```
===ARCHITECTURE===
[updated ARCHITECTURE.md content]
===DESIGN===
[updated DESIGN.md content]