# HabitualOS Design Documentation

## File Structure

```
habitualos/
├── db/                          # Database layer
│   ├── init.js                  # DB initialization and migrations
│   └── schema.sql               # SQLite schema definitions
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
│   ├── agent-chat.js            # Agent conversation interface
│   └── task-outputs.js          # Task execution results
│
├── scheduler/                   # Background task execution
│   ├── index.js                 # Cron scheduler entry point
│   └── task-executor.js         # Task execution logic
│
├── scripts/                     # Build and automation scripts
│   └── context-sync.js          # Maintains ARCHITECTURE.md + DESIGN.md
│
├── src/                         # Frontend source
│   ├── _includes/               # Nunjucks templates
│   │   └── base.njk             # Base layout template
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
│   │   ├── agent.njk            # Agent detail page
│   │   └── action.njk           # Action detail page
│   └── index.njk                # Homepage
│
├── data/tasks/                  # Task I/O storage
│   └── {task_id}/
│       ├── inputs/              # User-provided inputs
│       └── outputs/             # Agent-generated outputs
│
├── ARCHITECTURE.md              # High-level system design
├── DESIGN.md                    # This file - implementation details
├── CHANGELOG_RECENT.md          # Rolling buffer of recent commits
└── SYSTEM.md                    # Legacy context file (deprecated)
```

## Frontend Design Patterns

### Page Architecture

HabitualOS uses a **hybrid static/SPA approach**:
- Eleventy generates static HTML for each page
- JavaScript progressively enhances with dynamic features
- No heavy frontend framework - vanilla ES6 modules

### Key Frontend Files

#### `/src/scripts/app.js` (Main Application Logic)
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

#### `/src/do/agent.njk` (Agent Detail Page)
Three main views accessed via navigation tabs:
- **Chat View** - Conversational interface with agent
- **Actions View** - Grid of all actions for this agent
- **Assets View** - Files/artifacts generated (placeholder)
- **Settings View** - Agent configuration and metrics

Key inline scripts:
- Chat message rendering with markdown support
- Draft action card rendering (yellow dashed border)
- Draft action localStorage management
- View switching logic

#### `/src/do/setup.njk` (Agent Creation Flow)
Full-screen chat interface for creating agents:
- Opening greeting from AI
- Conversational extraction of goal, success criteria, timeline
- `READY_TO_CREATE` signal detection
- Modal confirmation before agent creation
- Creation overlay with animated progress

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

**Agent Creation** (`setup-chat.js`):
```
User: "I want to launch a SaaS product"
...conversation...
Assistant: "READY_TO_CREATE
---
TITLE: Launch SaaS MVP
GOAL: Build and deploy..."
```

**Action Generation** (`agent-chat.js`):
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

Agent chat includes ARCHITECTURE.md in system prompt:
```javascript
const systemContext = fs.readFileSync('SYSTEM.md', 'utf8');

const systemPrompt = `You're an autonomous agent...

${systemContext ? `
---
## Codebase Context
${systemContext}
Use this context to have informed design discussions.
` : ''}`;
```

This enables agents to:
- Understand project structure when suggesting deliverables
- Make architecturally-informed recommendations
- Reference specific files/patterns in responses

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

### 4. Context Sync Workflow

```
Developer commits code
  ↓
Git post-commit hook
  - Appends commit info to CHANGELOG_RECENT.md
  - Includes: hash, author, message, changed files
  ↓
User says "update context" in agent chat
  (or runs: node scripts/context-sync.js)
  ↓
Context sync script:
  - Reads CHANGELOG_RECENT.md
  - Reads existing ARCHITECTURE.md + DESIGN.md
  - Calls LLM with synthesis prompt
  - Writes updated docs
  - Clears CHANGELOG_RECENT.md
  ↓
Next agent chat includes updated docs in context
```

## Styling and UI Patterns

### Design System

**Colors** (from `_variables.scss`):
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

## Testing and Debugging

### Manual Testing Checklist

**Agent Creation**:
- [ ] Opening message displays
- [ ] Chat input works (Enter to submit, Shift+Enter for newline)
- [ ] AI extracts goal, criteria, timeline correctly
- [ ] READY_TO_CREATE signal appears
- [ ] Modal shows "Create My Agent" button
- [ ] Agent is created and redirect happens

**Agent Chat**:
- [ ] Greeting message displays on load
- [ ] Chat history persists during session
- [ ] Action generation triggers on request
- [ ] Draft action card appears inline
- [ ] Draft action saved to localStorage
- [ ] Context sync command works ("update context")

**Dashboard**:
- [ ] Agents render correctly
- [ ] Actions grouped by agent
- [ ] Filter by state works (all/scheduled/active/completed)
- [ ] Click navigation works (agent detail, action detail)

### Common Debugging Patterns

**LLM not generating expected signal**:
- Check system prompt for clarity
- Verify signal format in prompt examples
- Log full LLM response to console
- Adjust parsing regex to be more flexible

**localStorage issues**:
- Check browser privacy settings
- Verify key names match across files
- Test with sessionStorage fallback
- Clear storage and retry

**Database query failures**:
- Verify user ID format (`u-{timestamp}-{random}`)
- Check SQL syntax in service layer
- Log query parameters before execution
- Verify JSONB fields are parsed correctly

## Performance Considerations

### Frontend Optimization
- Minimal JavaScript bundle (vanilla JS, no frameworks)
- CSS compiled and minified via Sass
- Static assets served from CDN
- No runtime template compilation (Eleventy pre-renders)

### Backend Optimization
- SQLite for fast local queries
- Connection pooling (better-sqlite3)
- No N+1 queries (service layer handles joins)
- LLM calls are the bottleneck (not database)

### Future Optimizations
- Implement request caching for agent/action lists
- Use incremental static regeneration for dashboards
- Add pagination for large action lists
- Stream LLM responses for real-time feedback
