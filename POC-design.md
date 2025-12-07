# HabitualOS - Proof of Concept Design Specification

**Version:** 1.0  
**Date:** December 7, 2025  
**Scope:** Minimal viable PoC for dogfooding the system to build itself

---

## Executive Summary

This PoC creates a functional personal AI orchestration system where:
- User creates a NorthStar goal
- AI agent generates 3-5 actionable steps
- User refines actions via persistent chat
- Agent generates artifacts (stored locally)
- User marks actions complete or dismisses them
- System tracks tangible progress

**Timeline:** ~3 hours focused development  
**Purpose:** Dogfood HabitualOS to build HabitualOS

---

## Core Principles

1. **Open Source Framework, Private Data**
   - All code, templates, styles committed to git
   - User data (SQLite DB, API keys) NEVER committed
   - Anyone can clone and run their own instance

2. **Local-First Architecture**
   - SQLite database in project root
   - Artifacts stored in DB (full content)
   - External delivery is optional future feature

3. **Clean, AI-Implementable Patterns**
   - Well-documented Sass structure
   - Clear component conventions
   - Inline comments explaining patterns

4. **Mobile-Friendly from Day One**
   - Responsive layouts
   - Full-page views (no modals)
   - Touch-friendly interactions

---

## Tech Stack

### Frontend
- **11ty** (v2.x) - Static site generator
- **Nunjucks** - Templating engine
- **Sass** - CSS preprocessing
- **Vanilla JavaScript** - Progressive enhancement

### Backend
- **Netlify Functions** - Serverless endpoints
- **SQLite** - Local database (better-sqlite3)
- **Claude API** - AI agent (Anthropic)

### Dependencies
```json
{
  "dependencies": {
    "@11ty/eleventy": "^2.0.1",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "sass": "^1.69.5",
    "npm-run-all": "^4.1.5"
  }
}
```

---

## File Structure

```
habitualos/
├── src/
│   ├── _includes/
│   │   ├── base.njk              # Base HTML template
│   │   ├── breadcrumb.njk        # Breadcrumb component
│   │   └── action-card.njk       # ActionCard component
│   ├── styles/
│   │   ├── main.scss             # Entry point
│   │   ├── _variables.scss       # Colors, spacing, breakpoints
│   │   ├── _base.scss            # Resets, typography
│   │   ├── _layout.scss          # Grid, containers, layouts
│   │   └── _components.scss      # Buttons, cards, forms, chat
│   ├── scripts/
│   │   └── app.js                # Client-side JavaScript
│   ├── index.njk                 # Agent dashboard
│   ├── action.njk                # Action detail page
│   └── setup.njk                 # NorthStar creation
├── netlify/
│   └── functions/
│       ├── northstar-create.js   # Create NorthStar + generate actions
│       ├── actions-list.js       # Get all actions
│       ├── action-get.js         # Get action + chat + artifacts
│       ├── action-chat.js        # Send message, get response
│       ├── action-generate.js    # Generate artifact content
│       ├── action-complete.js    # Mark action complete
│       └── action-dismiss.js     # Dismiss action with reason
├── db/
│   ├── schema.sql                # Database schema
│   ├── init.js                   # Database initialization
│   └── .gitkeep                  # Keep folder in git
├── .eleventy.js                  # 11ty configuration
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── package.json
├── netlify.toml                  # Netlify configuration
└── README.md
```

---

## Database Schema

### SQLite Tables

```sql
-- NorthStars: User's overarching goals
CREATE TABLE north_stars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  success_criteria TEXT,           -- JSON array as string
  timeline TEXT,
  status TEXT DEFAULT 'active',    -- active | completed | archived
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ActionCards: Discrete, executable steps
CREATE TABLE action_cards (
  id TEXT PRIMARY KEY,
  north_star_id TEXT NOT NULL REFERENCES north_stars(id),
  title TEXT NOT NULL,
  description TEXT,
  state TEXT DEFAULT 'open',       -- open | in_progress | completed | dismissed
  priority TEXT DEFAULT 'medium',  -- high | medium | low
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  dismissed_reason TEXT
);

-- Chat Messages: Persistent conversation history
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action_cards(id),
  role TEXT NOT NULL,              -- user | assistant
  content TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Artifacts: Generated work products
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action_cards(id),
  type TEXT NOT NULL,              -- markdown | code | image | data
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Full content stored locally
  destination TEXT,                -- github | substack | filesystem | null (future)
  destination_url TEXT,            -- External URL if delivered (future)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_action_cards_north_star ON action_cards(north_star_id);
CREATE INDEX idx_chat_messages_action ON chat_messages(action_id);
CREATE INDEX idx_artifacts_action ON artifacts(action_id);
```

---

## API Endpoints

### 1. POST `/api/northstar/create`
**Purpose:** Create NorthStar and generate initial ActionCards

**Request Body:**
```json
{
  "title": "Build HabitualOS MVP",
  "goal": "Create a working prototype ready for demo and job search",
  "success_criteria": ["Working UI", "Agent generates actions", "Artifacts stored"],
  "timeline": "December 2025"
}
```

**Response:**
```json
{
  "success": true,
  "northstar": {
    "id": "uuid",
    "title": "...",
    "goal": "..."
  },
  "actions": [
    {
      "id": "uuid",
      "title": "Set up project structure",
      "description": "...",
      "priority": "high"
    }
  ]
}
```

**Implementation:**
1. Insert NorthStar into DB
2. Call Claude API with action generation prompt
3. Parse response, insert ActionCards
4. Return NorthStar + actions

---

### 2. GET `/api/actions`
**Purpose:** Get all ActionCards for the NorthStar

**Query Parameters:** None (PoC has single NorthStar)

**Response:**
```json
{
  "success": true,
  "actions": [
    {
      "id": "uuid",
      "title": "...",
      "state": "open",
      "priority": "high",
      "created_at": "2025-12-07T10:00:00Z"
    }
  ]
}
```

---

### 3. GET `/api/action/:id`
**Purpose:** Get ActionCard details + chat history + artifacts

**Response:**
```json
{
  "success": true,
  "action": {
    "id": "uuid",
    "title": "...",
    "description": "...",
    "state": "in_progress",
    "priority": "high"
  },
  "chat": [
    {
      "role": "user",
      "content": "Can you add TypeScript?",
      "timestamp": "..."
    },
    {
      "role": "assistant",
      "content": "I'd recommend vanilla JS for PoC...",
      "timestamp": "..."
    }
  ],
  "artifacts": [
    {
      "id": "uuid",
      "type": "code",
      "title": "project-structure.md",
      "created_at": "..."
    }
  ]
}
```

---

### 4. POST `/api/action/:id/chat`
**Purpose:** Send user message, get AI response

**Request Body:**
```json
{
  "message": "Can you make this more detailed?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Sure! I'll expand the description to include...",
  "updated_state": "in_progress"
}
```

**Implementation:**
1. Insert user message to chat_messages
2. Build conversation history from DB
3. Call Claude API with full context
4. Insert assistant response to chat_messages
5. Update action state to 'in_progress' if it was 'open'
6. Return response

---

### 5. POST `/api/action/:id/generate`
**Purpose:** Generate artifact content (e.g., markdown document, code file)

**Request Body:**
```json
{
  "type": "markdown",
  "title": "Project Structure Documentation"
}
```

**Response:**
```json
{
  "success": true,
  "artifact": {
    "id": "uuid",
    "type": "markdown",
    "title": "Project Structure Documentation",
    "content": "# Project Structure\n\n...",
    "created_at": "..."
  }
}
```

**Implementation:**
1. Get action + chat history from DB
2. Call Claude API with artifact generation prompt
3. Insert artifact into DB with full content
4. Return artifact metadata + content

---

### 6. POST `/api/action/:id/complete`
**Purpose:** Mark ActionCard as completed

**Response:**
```json
{
  "success": true,
  "action": {
    "id": "uuid",
    "state": "completed",
    "completed_at": "2025-12-07T12:00:00Z"
  }
}
```

**Implementation:**
1. Update action_cards SET state='completed', completed_at=NOW()
2. Return updated action

---

### 7. POST `/api/action/:id/dismiss`
**Purpose:** Dismiss ActionCard with reason

**Request Body:**
```json
{
  "reason": "Not relevant right now, will revisit later"
}
```

**Response:**
```json
{
  "success": true,
  "action": {
    "id": "uuid",
    "state": "dismissed"
  }
}
```

**Implementation:**
1. Insert dismissal reason as system message in chat_messages
2. Update action_cards SET state='dismissed', dismissed_reason=reason
3. Return updated action

---

## Claude API Integration

### Action Generation Prompt

```javascript
const generateActionsPrompt = `You are an AI agent helping a user achieve their goal.

NorthStar Goal: ${northStar.goal}
Success Criteria: ${northStar.success_criteria}
Timeline: ${northStar.timeline}

Generate 3-5 high-priority, immediately actionable steps to move toward this goal.

Requirements for each action:
- Completable in 1-4 hours
- Has a clear deliverable/outcome
- Does not depend on other actions being completed first
- Specific and concrete (not vague)
- Focuses on tangible work product

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "Short, clear action title",
    "description": "Detailed description of what needs to be done and why",
    "priority": "high|medium|low"
  }
]

No preamble, no explanation, just the JSON array.`;
```

### Chat Refinement Prompt

```javascript
const chatPrompt = `You are an AI agent helping refine an actionable task.

Action: ${action.title}
Description: ${action.description}

Conversation history:
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's latest message: ${userMessage}

Respond helpfully to refine the action. Be concise and actionable.`;
```

### Artifact Generation Prompt

```javascript
const artifactPrompt = `You are an AI agent generating a work artifact.

Action: ${action.title}
Description: ${action.description}

Conversation history (for context):
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Generate a ${type} artifact titled "${title}".

Requirements:
- High quality, production-ready content
- Follow best practices for ${type}
- Be thorough but concise
- Return ONLY the artifact content, no preamble or explanation

${type === 'markdown' ? 'Use proper markdown formatting.' : ''}
${type === 'code' ? 'Include comments and follow conventions.' : ''}
`;
```

---

## Frontend Pages

### 1. Agent Dashboard (`/` - index.njk)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ HabitualOS                                       │
├─────────────────────────────────────────────────┤
│ Your NorthStar                  [Active]        │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Build HabitualOS MVP                        │ │
│ │                                              │ │
│ │ Create a working prototype ready for demo   │ │
│ │ and job search                               │ │
│ │                                              │ │
│ │ Timeline: December 2025                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Progress: 2 completed, 1 in progress, 3 open   │
│                                                  │
├─────────────────────────────────────────────────┤
│ Action Cards                                     │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Set up project structure        [High] 🔴   │ │
│ │ Initialize 11ty, configure Sass...           │ │
│ │ [Open] →                                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Define database schema       [Medium] 🟡    │ │
│ │ Create SQLite tables for...                  │ │
│ │ [Open] →                                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Show Completed (2)]                            │
└─────────────────────────────────────────────────┘
```

**Data Loading:**
- Fetch NorthStar from DB (assume single one for PoC)
- Fetch all ActionCards
- Calculate progress metrics

**Interactions:**
- Click action card → Navigate to `/action/:id`
- Toggle "Show Completed" to reveal/hide completed actions

---

### 2. Action Detail Page (`/action/:id` - action.njk)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ ← Back to Dashboard                             │
├─────────────────────────────────────────────────┤
│ Set up project structure                        │
│ Priority: High | Status: In Progress            │
├─────────────────────────────────────────────────┤
│                                                  │
│ Description:                                     │
│ Initialize 11ty, configure Sass, set up folder  │
│ structure, create basic templates...             │
│                                                  │
├─────────────────────────────────────────────────┤
│ Chat History:                                    │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ USER: Can you add TypeScript support?    │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ ASSISTANT: I'd recommend sticking with   │   │
│ │ vanilla JavaScript for the PoC...         │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ USER: Ok, sounds good                     │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Type your message...                        │ │
│ └─────────────────────────────────────────────┘ │
│ [Send]                                          │
│                                                  │
├─────────────────────────────────────────────────┤
│ Artifacts:                                       │
│                                                  │
│ 📄 project-structure.md                         │
│ Created 2 hours ago                             │
│ [View Content] [Download]                       │
│                                                  │
│ [+ Generate New Artifact]                       │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Mark Complete] [Dismiss]                       │
└─────────────────────────────────────────────────┘
```

**Data Loading:**
- Fetch action details
- Fetch chat history
- Fetch artifacts

**Interactions:**
- Send message → POST to `/api/action/:id/chat`, append response
- Generate artifact → POST to `/api/action/:id/generate`, show modal/form for type + title
- View artifact → Expand/modal to show full content
- Mark complete → Confirm, POST to `/api/action/:id/complete`, redirect to dashboard
- Dismiss → Show reason input, POST to `/api/action/:id/dismiss`, redirect to dashboard

---

### 3. Setup Page (`/setup` - setup.njk)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Welcome to HabitualOS                           │
│                                                  │
│ Let's create your NorthStar goal                │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Goal Title:                                 │ │
│ │ [                                         ] │ │
│ │                                              │ │
│ │ Goal Description:                            │ │
│ │ [                                         ] │ │
│ │ [                                         ] │ │
│ │                                              │ │
│ │ Success Criteria (one per line):             │ │
│ │ [                                         ] │ │
│ │ [                                         ] │ │
│ │ [                                         ] │ │
│ │                                              │ │
│ │ Timeline:                                    │ │
│ │ [                                         ] │ │
│ │                                              │ │
│ │ [Create NorthStar & Generate Actions]       │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- Submit form → POST to `/api/northstar/create`
- Show loading state while agent generates actions
- Redirect to `/` when complete

---

## Sass Structure

### Variables (`_variables.scss`)

```scss
// Colors
$color-primary: #2563eb;
$color-primary-dark: #1e40af;
$color-success: #10b981;
$color-warning: #f59e0b;
$color-danger: #ef4444;
$color-text: #1f2937;
$color-text-muted: #6b7280;
$color-bg: #ffffff;
$color-bg-muted: #f3f4f6;
$color-border: #e5e7eb;

// Spacing (8px base unit)
$space-xs: 0.25rem;
$space-sm: 0.5rem;
$space-md: 1rem;
$space-lg: 1.5rem;
$space-xl: 2rem;
$space-2xl: 3rem;

// Typography
$font-family: system-ui, -apple-system, sans-serif;
$font-size-sm: 0.875rem;
$font-size-base: 1rem;
$font-size-lg: 1.125rem;
$font-size-xl: 1.25rem;
$font-size-2xl: 1.5rem;
$font-size-3xl: 2rem;

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
```

### Components (`_components.scss`)

**Key Classes:**
- `.btn`, `.btn-primary`, `.btn-success`, `.btn-secondary`
- `.card`, `.card-title`, `.card-meta`
- `.badge`, `.badge-high`, `.badge-medium`, `.badge-low`
- `.chat-messages`, `.chat-message`, `.chat-message-user`, `.chat-message-assistant`
- `.form-group`, `.label`, `.input`, `.textarea`

(Full implementation in earlier conversation - copy from there)

---

## JavaScript Client-Side Logic

### Chat Interface (`src/scripts/app.js`)

```javascript
// Handle chat message submission
async function sendMessage(actionId, message) {
  const response = await fetch(`/api/action/${actionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  
  if (data.success) {
    appendMessage('user', message);
    appendMessage('assistant', data.response);
  }
}

// Append message to chat UI
function appendMessage(role, content) {
  const messagesContainer = document.querySelector('.chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message-${role}`;
  messageDiv.textContent = content;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle form submission
document.querySelector('#chat-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input[name="message"]');
  const message = input.value.trim();
  
  if (!message) return;
  
  const actionId = e.target.dataset.actionId;
  await sendMessage(actionId, message);
  input.value = '';
});
```

---

## Environment Configuration

### `.env.example`

```env
# Anthropic API Key
ANTHROPIC_API_KEY=your_api_key_here

# Database path (relative to project root)
DATABASE_PATH=./db/habitualos.db

# Environment
NODE_ENV=development
```

### `.gitignore`

```
# User data - NEVER commit
db/habitualos.db
.env

# Build artifacts
_site/
node_modules/

# System files
.DS_Store
*.log
```

---

## Build & Development Scripts

### `package.json` Scripts

```json
{
  "scripts": {
    "sass:build": "sass src/styles/main.scss:_site/css/main.css --style=compressed",
    "sass:watch": "sass src/styles/main.scss:_site/css/main.css --watch",
    "eleventy:build": "eleventy",
    "eleventy:serve": "eleventy --serve",
    "db:init": "node db/init.js",
    "dev": "npm-run-all db:init --parallel sass:watch eleventy:serve",
    "build": "npm-run-all db:init sass:build eleventy:build",
    "clean": "rm -rf _site"
  }
}
```

### Database Initialization (`db/init.js`)

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'habitualos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Create database if it doesn't exist
const db = new Database(dbPath);

// Read and execute schema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

console.log('✅ Database initialized');
db.close();
```

---

## Netlify Configuration

### `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "_site"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[dev]
  command = "npm run dev"
  port = 8080
  targetPort = 8080
  publish = "_site"
  autoLaunch = false
```

---

## Implementation Checklist

### Phase 1: Foundation (30-45 min)
- [ ] Initialize npm project, install dependencies
- [ ] Set up 11ty configuration (`.eleventy.js`)
- [ ] Create Sass structure (variables, base, layout, components)
- [ ] Create database schema (`db/schema.sql`)
- [ ] Create database init script (`db/init.js`)
- [ ] Set up `.env.example` and `.gitignore`
- [ ] Verify local dev server runs

### Phase 2: Data Layer (30-45 min)
- [ ] Create database helper module (`db/helpers.js`)
- [ ] Implement serverless function scaffolds (all 7 endpoints)
- [ ] Test Claude API integration (basic ping)
- [ ] Implement action generation logic
- [ ] Test CRUD operations in SQLite

### Phase 3: Frontend (45-60 min)
- [ ] Build base template (`_includes/base.njk`)
- [ ] Build setup page (`setup.njk`)
- [ ] Build dashboard page (`index.njk`)
- [ ] Build action detail page (`action.njk`)
- [ ] Create client-side JavaScript (`scripts/app.js`)
- [ ] Wire up form submissions

### Phase 4: Integration (30 min)
- [ ] Test full flow: Create NorthStar → Generate actions
- [ ] Test chat refinement
- [ ] Test artifact generation
- [ ] Test complete/dismiss
- [ ] Add loading states and error handling
- [ ] Mobile testing

### Phase 5: Polish (Optional)
- [ ] Improve error messages
- [ ] Add success/confirmation messages
- [ ] Optimize Sass (remove unused styles)
- [ ] Add basic animations/transitions
- [ ] Write README with setup instructions

---

## Success Criteria

The PoC is complete when:

1. ✅ User can create a NorthStar via `/setup`
2. ✅ Agent generates 3-5 ActionCards automatically
3. ✅ User can view ActionCards on dashboard
4. ✅ User can chat with agent to refine an action
5. ✅ Agent responds intelligently based on conversation history
6. ✅ User can request artifact generation
7. ✅ Artifact content is stored in DB and viewable
8. ✅ User can mark actions complete or dismiss them
9. ✅ Progress metrics update correctly
10. ✅ All data persists in SQLite (not committed to git)

---

## Non-Goals (Deferred to Later)

- ❌ Multi-agent support (dashboard to select agents)
- ❌ MCP integrations (GitHub, Substack, etc.)
- ❌ External artifact delivery
- ❌ mem0 integration
- ❌ Scheduled check-ins
- ❌ Authentication/multi-user
- ❌ Rich markdown preview
- ❌ File uploads
- ❌ Real-time updates (WebSockets)
- ❌ Advanced error recovery
- ❌ Bi-directional sync

---

## Dogfooding Plan

Once PoC is functional:

**NorthStar:** "Build HabitualOS MVP ready for demo"

**Expected Initial Actions:**
1. Set up project structure (11ty + Sass + serverless)
2. Define database schema and initialization
3. Implement Claude API integration for action generation
4. Build dashboard UI showing NorthStar and ActionCards
5. Create chat interface for refining ActionCards

**User Flow:**
- Refine action #1 via chat: "Should we use TypeScript?"
- Agent responds with recommendation
- Mark action #1 complete when project structure is set up
- Move to action #2, repeat process
- **HabitualOS builds itself using itself**

---

## Notes for Claude Code

- Follow the Sass structure exactly (variables → base → layout → components)
- Add inline comments explaining patterns for future AI extension
- Keep serverless functions small and focused (single responsibility)
- Use async/await consistently (no callbacks)
- Handle errors gracefully (return JSON with `success: false`)
- Test each endpoint manually before moving to next phase
- Commit frequently with clear messages
- If stuck, refer back to ARCHITECTURE.md for context

---

**Ready to build!**