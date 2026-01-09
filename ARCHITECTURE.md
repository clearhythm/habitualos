---
last_sync: 2026-01-09T05:14:52.052Z
last_commit: 2026-01-09T05:20:01Z
commits_since_sync: 1
---

# HabitualOS Architecture

## Overview

HabitualOS is a personal AI orchestration platform that helps you accomplish goals through autonomous AI agents. Users create agents with clear goals, and those agents generate actionable deliverables through conversational interfaces.

**Core Philosophy**: Agents do ALL the work - users just provide context. This inverts traditional productivity tools where the user does the work and the tool just tracks it.

## High-Level System Design

### User Journey

1. **Agent Creation** - Chat-based flow to define a goal, success criteria, and timeline
2. **Deliverable Generation** - Agent creates specific, actionable deliverables through conversation
3. **Refinement** - Draft deliverables are refined via chat until well-defined
4. **Scheduling** - Deliverables can be scheduled for autonomous execution
5. **Completion** - Agents execute work and produce artifacts (drafts, files, etc.)

### Core Concepts

#### Agents
Autonomous AI assistants tied to a specific goal. Each agent:
- Has a **North Star goal** (what you want to achieve)
- Has **success criteria** (how you'll know it's done)
- Has a **timeline** (when you're aiming for)
- Generates **actions** (deliverables the agent will create)
- Maintains **conversational context** about your goal

#### Actions
Specific deliverables the agent will create. Actions have:
- **Draft** state: Generated but not yet finalized (stored in localStorage)
- **Defined** state: Finalized and persisted to database (ready for scheduling)
- **Scheduled** state: Queued for autonomous execution at specific time
- **Completed** state: Work has been done, artifacts created

#### Living Documentation System
Maintains synchronized architecture and design documentation that evolves with the codebase:
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: High-level system design, core concepts, technology stack, data flow
- **[DESIGN.md](DESIGN.md)**: Implementation details, file structure, code patterns, workflows
- **[CHANGELOG_RECENT.md](CHANGELOG_RECENT.md)**: Rolling buffer of recent commits (cleared after each sync)
- **[.context-sync-status.json](.context-sync-status.json)**: Tracks last sync timestamp and commit count

**Sync Workflow**:
1. Git post-commit hook appends commit info to CHANGELOG_RECENT.md
2. Manual or agent-triggered sync processes changelog via LLM ([scripts/context-sync.js](scripts/context-sync.js))
3. LLM updates both ARCHITECTURE.md and DESIGN.md based on changes
4. Updated docs included in agent chat API calls for context-aware design discussions
5. Agents can request context updates via "update context" command in chat

This enables agents to:
- Understand current system architecture when suggesting deliverables
- Make architecturally-informed recommendations
- Reference specific files and patterns in responses
- Maintain accurate mental model of codebase as it evolves

## Technology Stack

### Frontend
- **Eleventy (11ty)**: Static site generator
- **Nunjucks**: Templating engine for HTML
- **Sass**: CSS preprocessing with modular structure
- **Vanilla JavaScript**: Progressive enhancement, ES6 modules
- **localStorage**: Client-side storage for draft actions and auth state

### Backend
- **Netlify Functions**: Serverless API endpoints (Node.js)
- **SQLite (better-sqlite3)**: Embedded database for agents, actions, chat history
- **Anthropic Claude API**: Conversational AI (claude-sonnet-4-5)
- **node-cron**: Task scheduling for autonomous execution

### Development
- **Netlify Dev**: Local development server with functions
- **Git Hooks**: Automated changelog tracking (post-commit)
- **npm-run-all**: Parallel process orchestration

## System Architecture

### Data Flow

```
User → Browser (Eleventy SPA) → Netlify Functions → SQLite Database
                                ↓
                         Anthropic Claude API
                                ↓
                         Generated Deliverables
```

### Key Subsystems

#### 1. Agent Creation Flow
- Chat-based onboarding ([src/do/setup.njk](src/do/setup.njk))
- Conversational extraction of goal, success criteria, timeline
- Signal-based readiness detection (READY_TO_CREATE)
- Automatic persistence of creation chat history

#### 2. Agent Chat Interface
- Persistent chat with agent about the goal ([src/do/agent.njk](src/do/agent.njk))
- Action generation via structured LLM output (GENERATE_ACTIONS)
- Draft action cards rendered inline in chat
- Context-aware discussions using ARCHITECTURE.md + DESIGN.md
- In-chat context sync command ("update context")

#### 3. Draft Action Lifecycle
- Agent generates single action at a time
- Draft stored in localStorage (not DB) until refined
- User can refine via continued chat
- "Define" button persists to database as actionable deliverable

#### 4. Scheduled Task Execution
- Scheduler polls DB every minute for `schedule_time <= now`
- Executes tasks via iterative LLM calls
- Saves outputs to `data/tasks/{task_id}/outputs/`
- Updates action state to completed

#### 5. Living Documentation System
- Post-commit hook: git changes → CHANGELOG_RECENT.md
- Sync command: changelog → LLM synthesis → ARCHITECTURE.md + DESIGN.md
- Agent integration: both docs included in system prompt for context
- Tracks sync status in .context-sync-status.json

## Database Schema

### Tables

```sql
-- Agents: Autonomous AI assistants for specific goals
agents (
  id TEXT PRIMARY KEY,
  _userId TEXT,
  name TEXT,
  status TEXT,  -- 'active' | 'paused' | 'archived'
  model TEXT,
  instructions JSONB,  -- { goal, success_criteria, timeline }
  metrics JSONB,       -- { totalCost, completedActions, totalActions }
  _createdAt TEXT,
  _updatedAt TEXT
)

-- Agent Creation Chats: Conversation history from agent setup
agent_creation_chats (
  id TEXT PRIMARY KEY,
  _userId TEXT,
  agentId TEXT,
  messages JSONB,  -- Array of { role, content, timestamp }
  _createdAt TEXT
)

-- Actions: Deliverables generated by agents
actions (
  id TEXT PRIMARY KEY,
  _userId TEXT,
  agentId TEXT,
  title TEXT,
  description TEXT,
  state TEXT,  -- 'draft' | 'defined' | 'scheduled' | 'in_progress' | 'completed'
  priority TEXT,  -- 'high' | 'medium' | 'low'
  taskType TEXT,  -- 'interactive' | 'scheduled'
  scheduleTime TEXT,
  taskConfig JSONB,
  _createdAt TEXT,
  _updatedAt TEXT
)

-- Action Chat Messages: Conversation history for action refinement
action_chat_messages (
  id TEXT PRIMARY KEY,
  actionId TEXT,
  role TEXT,  -- 'user' | 'assistant'
  content TEXT,
  timestamp TEXT
)

-- Task Outputs: Results from scheduled task execution
task_outputs (
  id TEXT PRIMARY KEY,
  taskId TEXT,
  actionId TEXT,
  output TEXT,
  status TEXT,
  _createdAt TEXT
)
```

## API Endpoints

### Agent Management
- `POST /agent-create` - Create new agent from chat conversation
- `GET /agent-get?id={id}` - Fetch agent details
- `GET /agents-list?userId={userId}` - List all user's agents
- `POST /agent-update` - Update agent settings

### Agent Chat
- `POST /setup-chat` - Agent creation conversation
- `POST /agent-chat` - Chat with existing agent (includes ARCHITECTURE.md + DESIGN.md context)

### Action Management
- `POST /action-generate` - Generate new action for agent
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
- Environment variables: `ANTHROPIC_API_KEY`, `DATABASE_URL`
- Functions deployed as serverless endpoints
- Static assets served from global CDN
- SQLite database stored on Netlify filesystem (ephemeral on redeploy)

## Future Considerations

### Planned Enhancements
- **Multi-user auth** - Proper login/signup with Netlify Identity
- **Persistent database** - Move from SQLite to Postgres/PlanetScale
- **Cloud storage** - S3/R2 for task outputs and artifacts
- **MCP integrations** - Publish deliverables to external tools (Linear, Notion, etc.)
- **Embodiment practices** - Agent suggests somatic/physical practices aligned with goals
- **Background functions** - Move scheduler to Netlify Background Functions

### Architectural Evolution
- **Event-driven architecture** - Webhooks for action state changes
- **Queue-based execution** - Redis/Bull for task prioritization
- **Real-time updates** - WebSockets or SSE for live progress
- **Agent-to-agent communication** - Agents collaborate on complex goals