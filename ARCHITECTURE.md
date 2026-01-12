---
last_sync: 2026-01-12T19:04:42.011Z
last_commit: 2026-01-11T06:19:18Z
commits_since_sync: 0
---

# HabitualOS Architecture

## Overview

HabitualOS is a personal AI orchestration platform that helps you accomplish goals through autonomous AI agents. Users create agents with clear goals, and those agents generate actionable deliverables through conversational interfaces.

**Core Philosophy**: Agents do ALL the work - users just provide context. This inverts traditional productivity tools where the user does the work and the tool just tracks it.

## High-Level System Design

### User Journey

1. **Agent Creation** - Chat-based flow to define a goal, success criteria, and timeline
2. **Deliverable Generation** - Agent creates specific deliverables through conversation:
   - **Assets** - Immediate deliverables with full content (documents, code, prompts)
   - **Actions** - Future work to be done later (scheduled or interactive tasks)
3. **Refinement** - Draft deliverables are refined via chat until well-defined
4. **Persistence** - Chat history saved to Firestore when deliverable generated
5. **Scheduling** - Actions can be scheduled for autonomous execution with taskConfig
6. **Completion** - Agents execute work and produce artifacts (drafts, files, etc.)

### Core Concepts

#### Agents
Autonomous AI assistants tied to a specific goal. Each agent:
- Has a **North Star goal** (what the agent IS and DOES, e.g., "A strategic architecture agent that generates prompts")
- Has **success criteria** (how you'll know it's done)
- Has a **timeline** (when you're aiming for, or "Ongoing" for indefinite agents)
- Generates **deliverables** (assets and actions)
- Maintains **conversational context** about your goal
- Can perform operations via **tool registry** (sync documentation, etc.)

#### Assets
Immediate deliverables delivered with full content NOW:
- Specification documents
- Code snippets
- Email drafts
- Design documents
- Stored as **Proposed** state in localStorage until user saves
- Full content included in generation response

#### Actions
Future work to be done LATER at a scheduled time:
- **Draft** state: Generated but not yet finalized (stored in localStorage)
- **Defined** state: Finalized and persisted to database (ready for scheduling)
- **Scheduled** state: Queued for autonomous execution at specific time
- **In Progress** state: Currently being executed
- **Completed** state: Work has been done, artifacts created
- Include **taskConfig** for autonomous execution (instructions, expectedOutput)

#### Agent Chats
Persistent conversation history tracking deliverable generation:
- **Lifecycle**: Created on first deliverable, appended during refinements, cleared on approval
- **Stored**: Full message history, generated asset IDs, generated action IDs
- **Purpose**: Audit trail, refinement context, debugging

#### Living Documentation System
Self-maintaining architecture and design documentation that evolves with the codebase:
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: High-level system design, core concepts, technology stack, data flow
- **[DESIGN.md](DESIGN.md)**: Implementation details, file structure, code patterns, workflows
- **[CHANGELOG_RECENT.md](CHANGELOG_RECENT.md)**: Rolling buffer of recent commits (cleared after each sync)
- **Frontmatter tracking**: `last_sync`, `last_commit`, `commits_since_sync` in both docs

**Sync Workflow**:
1. Git post-commit hook appends commit info to CHANGELOG_RECENT.md and updates frontmatter
2. Agent detects staleness via frontmatter (3+ commits = proactive suggestion, 1-2 = casual mention)
3. Agent can autonomously sync via `sync_documentation` tool or user triggers manually
4. LLM updates both ARCHITECTURE.md and DESIGN.md based on changes via [scripts/context-sync.js](scripts/context-sync.js)
5. Updated docs included in agent chat API calls with **prompt caching** for cost efficiency
6. Frontmatter updated with new sync timestamp, commits reset to 0

**Prompt Caching**:
- System prompts (including ARCHITECTURE.md + DESIGN.md) cached with ephemeral cache_control
- First call pays full cost, subsequent calls in 5-minute window pay ~10% for cached portion
- ~90% cost reduction for conversational chats (~10k tokens cached)

This enables agents to:
- Detect when documentation is stale and proactively suggest updates
- Autonomously sync documentation via tool system
- Understand current system architecture when suggesting deliverables
- Make architecturally-informed recommendations
- Reference specific files and patterns in responses
- Maintain accurate mental model of codebase as it evolves

#### Tool Registry System
MCP-adjacent declarative tool system for agent capabilities beyond deliverable generation:
- **Registry**: Central tool definitions with MCP-compatible schemas ([netlify/functions/_tools/registry.cjs](netlify/functions/_tools/registry.cjs))
- **Tools**: Modules exporting execute(input) functions ([netlify/functions/_tools/sync-documentation.cjs](netlify/functions/_tools/sync-documentation.cjs))
- **Signal**: Agents use `USE_TOOL: tool_name` format to invoke tools
- **Future-proof**: Can become actual MCP server when needed

## Technology Stack

### Frontend
- **Eleventy (11ty)**: Static site generator
- **Nunjucks**: Templating engine for HTML
- **Sass**: CSS preprocessing with modular structure
- **Vanilla JavaScript**: Progressive enhancement, ES6 modules
- **localStorage**: Client-side storage for draft actions/assets and auth state

### Backend
- **Netlify Functions**: Serverless API endpoints (Node.js)
- **Firestore**: Cloud NoSQL database for agents, actions, assets, chat history
- **Anthropic Claude API**: Conversational AI (claude-sonnet-4-20250514) with prompt caching
- **node-cron**: Task scheduling for autonomous execution

### Development
- **Netlify Dev**: Local development server with functions
- **Git Hooks**: Automated changelog tracking and frontmatter updates (post-commit)
- **npm-run-all**: Parallel process orchestration

## System Architecture

### Data Flow

```
User → Browser (Eleventy SPA) → Netlify Functions → Firestore Database
                                ↓
                         Anthropic Claude API (with prompt caching)
                                ↓
                         Tool Registry (optional)
                                ↓
                         Generated Deliverables (Assets/Actions)
```

### Key Subsystems

#### 1. Agent Creation Flow
- Chat-based onboarding ([src/do/setup.njk](src/do/setup.njk))
- Conversational extraction of goal (framed as "A [type] agent that [does what]"), success criteria, timeline
- Timeline can be specific date/range or "Ongoing" for indefinite agents
- Signal-based readiness detection (READY_TO_CREATE)
- Automatic persistence of creation chat history

#### 2. Agent Chat Interface
- Persistent chat with agent about the goal ([src/do/agent.njk](src/do/agent.njk))
- Asset generation via structured LLM output (GENERATE_ASSET) - full content delivered immediately
- Action generation via structured LLM output (GENERATE_ACTIONS) - scheduled for later execution
- Draft deliverable cards rendered inline in chat
- Context-aware discussions using ARCHITECTURE.md + DESIGN.md (prompt cached)
- Staleness detection via frontmatter in agent responses
- Tool invocation via USE_TOOL signal
- Manual conversation reset button
- Chat lifecycle: create → append refinements → clear on approval

#### 3. Draft Deliverable Lifecycle

**Assets**:
- Agent generates asset with full content (spec doc, code, email, etc.)
- Proposed asset stored in localStorage until user saves
- User can refine via continued chat (appends to same chat session)
- "Save to Assets" button persists to database and clears chat
- Delete button available to discard unwanted proposals

**Actions**:
- Agent generates action with title, description, priority, taskConfig
- Draft stored in localStorage (not DB) until refined
- User can refine via continued chat (appends to same chat session)
- "Mark as Defined" button persists to database and clears chat
- Delete button available to discard unwanted drafts

#### 4. Scheduled Task Execution
- Scheduler polls DB every minute for `schedule_time <= now`
- Executes tasks via iterative LLM calls
- Uses taskConfig (instructions, expectedOutput) for autonomous execution
- Saves outputs to `data/tasks/{task_id}/outputs/`
- Updates action state to completed

#### 5. Living Documentation System
- Post-commit hook: git changes → CHANGELOG_RECENT.md + frontmatter update
- Staleness detection: agent reads frontmatter, suggests sync at 3+ commits
- Autonomous sync: agent invokes sync_documentation tool via USE_TOOL signal
- Manual sync: user runs `node scripts/context-sync.js` or types "update context" in chat
- Sync command: changelog → LLM synthesis (prompt cached) → ARCHITECTURE.md + DESIGN.md
- Frontmatter update: reset commits_since_sync to 0, update last_sync timestamp

#### 6. Tool Registry System
- Declarative tool definitions in registry with MCP-compatible schemas
- Agent system prompt includes available tools documentation
- Agents signal tool usage: `USE_TOOL: tool_name`
- Backend detects signal, routes to registry, executes tool
- Tool results returned to conversation for agent awareness
- Current tools: `sync_documentation` (runs context-sync.js)

## Database Schema

### Collections

```javascript
// Agents: Autonomous AI assistants for specific goals
agents {
  id: string,                    // Primary key
  _userId: string,
  name: string,
  status: string,                // 'active' | 'paused' | 'archived'
  model: string,
  instructions: {                // Object
    goal: string,                // "A [type] agent that [does what]"
    success_criteria: string,
    timeline: string             // Specific date or "Ongoing"
  },
  metrics: {                     // Object
    totalCost: number,
    completedActions: number,
    totalActions: number
  },
  _createdAt: string,
  _updatedAt: string
}

// Agent Creation Chats: Conversation history from agent setup
agent_creation_chats {
  id: string,                    // Primary key, format: agcc-{timestamp}-{random}
  _userId: string,
  agentId: string,
  messages: array,               // [{ role, content, timestamp }]
  _createdAt: string
}

// Agent Chats: Conversation history for deliverable generation and refinement
agent_chats {
  id: string,                    // Primary key, format: agc-{timestamp}-{random}
  _userId: string,
  agentId: string,
  messages: array,               // [{ role, content, timestamp }]
  generatedAssets: array,        // Array of asset IDs created in this session
  generatedActions: array,       // Array of action IDs created in this session
  _createdAt: string,
  _updatedAt: string
}

// Actions: Future deliverables to be done later
actions {
  id: string,                    // Primary key
  _userId: string,
  agentId: string,
  title: string,
  description: string,
  state: string,                 // 'draft' | 'defined' | 'scheduled' | 'in_progress' | 'completed'
  priority: string,              // 'high' | 'medium' | 'low'
  taskType: string,              // 'interactive' | 'scheduled'
  scheduleTime: string,
  taskConfig: {                  // Object (for autonomous execution)
    instructions: string,        // Detailed execution instructions
    expectedOutput: string       // What the output should include
  },
  _createdAt: string,
  _updatedAt: string
}

// Assets: Immediate deliverables with full content
assets {
  id: string,                    // Primary key
  _userId: string,
  agentId: string,
  title: string,
  description: string,
  content: string,               // Full content delivered immediately
  assetType: string,             // 'document' | 'code' | 'prompt' | 'email' | etc.
  _createdAt: string,
  _updatedAt: string
}

// Task Outputs: Results from scheduled task execution
task_outputs {
  id: string,                    // Primary key
  taskId: string,
  actionId: string,
  output: string,
  status: string,
  _createdAt: string
}
```

## API Endpoints

### Agent Management
- `POST /agent-create` - Create new agent from chat conversation
- `GET /agent-get?id={id}` - Fetch agent details
- `GET /agents-list?userId={userId}` - List all user's agents
- `POST /agent-update` - Update agent settings

### Agent Chat
- `POST /setup-chat` - Agent creation conversation
- `POST /agent-chat` - Chat with existing agent (includes ARCHITECTURE.md + DESIGN.md context, prompt cached)
- `POST /agent-chat-save` - Save or append to agent chat history (mode: 'create' | 'append')

### Action Management
- `POST /action-define` - Persist draft action to database
- `GET /action-get?id={id}` - Fetch action details
- `GET /actions-list?agentId={agentId}` - List agent's actions
- `POST /action-complete` - Mark action as completed
- `POST /action-dismiss` - Dismiss/archive action

### Task Execution
- `GET /task-outputs?taskId={id}` - Fetch task execution results

## Security Model

### Authentication
- Client-side user ID generation and persistence
- User ID format: `u-{timestamp}-{random}`
- Stored in localStorage with fallback to sessionStorage
- No authentication system yet (planned: proper auth)

### Authorization
- All database queries filtered by `_userId`
- Agent access restricted to owner
- Action access restricted to agent owner

### File Operations
- Restricted to `data/tasks/` directory
- UUID validation prevents path traversal
- Sanitized filenames (no special characters)
- Read-only inputs, write-only outputs

## Deployment

### Local Development
```bash
npm start  # Runs Sass, Eleventy, Netlify Dev, Scheduler in parallel
```

### Production (Netlify)
- Automatic deploys from `main` branch
- Environment variables: `ANTHROPIC_API_KEY`, `FIREBASE_ADMIN_CREDENTIALS`
- Functions deployed as serverless endpoints with prompt caching
- Static assets served from global CDN
- Firestore database (persistent cloud storage)

## Future Considerations

### Planned Enhancements
- **Multi-user auth** - Proper login/signup with Netlify Identity
- **Cloud storage** - S3/R2 for task outputs and artifacts
- **MCP server** - Convert tool registry to actual Model Context Protocol server
- **Expanded tool capabilities** - generate_shift_cards, query_actions, query_assets, external integrations
- **Embodiment practices** - Agent suggests somatic/physical practices aligned with goals
- **Background functions** - Move scheduler to Netlify Background Functions

### Architectural Evolution
- **Event-driven architecture** - Webhooks for action state changes
- **Queue-based execution** - Redis/Bull for task prioritization
- **Real-time updates** - WebSockets or SSE for live progress
- **Agent-to-agent communication** - Agents collaborate on complex goals