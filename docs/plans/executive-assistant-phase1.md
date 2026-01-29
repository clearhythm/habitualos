# Executive Assistant - Phase 1: Data Layer + EA Agent Logic

## Context

We're redesigning the `/do/` section to mirror the practice system's psychological approach. Instead of a "chorus of agents with projects," we want:
- **EA (Executive Assistant)** as single conversational entry point
- **Projects** as the organizing concept (what you care about)
- **Work Logs** for retrospective tracking (what you did)
- **Agents** become tactical workers EA dispatches

This phase builds the data layer and EA agent logic. No UI changes yet.

## Prior Art to Reference

**Practice system patterns** (what we're mirroring):
- `netlify/functions/_services/db-practice-logs.cjs` - similar structure to work logs
- `netlify/functions/practice-submit.js` - similar to work-log-submit
- `netlify/functions/practice-chat.js` - **primary reference for do-chat.js** (observational language, chat structure)

**Existing agent system** (data access patterns):
- `netlify/functions/_services/db-agents.cjs` - has `getAgentsByUserId`
- `netlify/functions/_services/db-actions.cjs` - has `getActionsByUserId`
- `netlify/functions/_services/db-agent-notes.cjs` - notes CRUD (EA will use this)
- `netlify/functions/agent-chat.js` - reference for tool handling patterns, but **not modified**

## What to Build

### 1. Projects Service (`netlify/functions/_services/db-projects.cjs`)

```javascript
// Schema:
{
  id: "project-{random}",
  name: "Career Launch",
  goal: "Get a job by March",
  status: "active", // active, paused, completed
  _userId: "u-xxx",
  _createdAt: timestamp,
  _updatedAt: timestamp
}

// Functions needed:
- createProject(id, data)
- getProjectsByUserId(userId)
- getProject(projectId)
- updateProject(projectId, updates)
```

### 2. Work Logs Service (`netlify/functions/_services/db-work-logs.cjs`)

```javascript
// Schema:
{
  id: "w-{timestamp}-{random}",
  projectId: "project-xxx", // optional
  title: "Worked on resume formatting",
  duration: 45, // minutes, optional
  reflection: "...", // optional
  _userId: "u-xxx",
  _createdAt: timestamp
}

// Functions needed:
- createWorkLog(id, data)
- getWorkLogsByUserId(userId)
- getWorkLogsByProject(projectId, userId)
- getWorkLogCount(userId) // for stats
```

### 3. Project Endpoints

**`netlify/functions/project-list.js`** (GET):
- Query param: `userId`
- Returns: `{ success: true, projects: [...] }`

**`netlify/functions/project-create.js`** (POST):
- Body: `{ userId, name, goal }`
- Creates project with status: "active"
- Returns: `{ success: true, project: {...} }`

### 4. Work Log Endpoints

**`netlify/functions/work-log-list.js`** (GET):
- Query params: `userId`, optional `projectId`
- Returns: `{ success: true, workLogs: [...], totalCount: N }`

**`netlify/functions/work-log-submit.js`** (POST):
- Body: `{ userId, title, projectId?, duration?, reflection? }`
- Creates work log
- Returns: `{ success: true, workLog: {...}, totalCount: N }`

### 5. EA Chat Endpoint (`netlify/functions/do-chat.js`)

Create a **new dedicated endpoint** for EA conversations. This keeps EA logic separate from tactical agent work in `agent-chat.js`.

**Architecture decision**: EA gets its own endpoint rather than being a special case in `agent-chat.js`. This allows the EA to evolve independently and stay focused on the human-facing conversational experience.

**Reference**: Use `practice-chat.js` as the structural model, `agent-chat.js` for tool handling patterns.

**Request body**:
```javascript
{
  userId: "u-xxx",
  message: "What should I work on?",
  chatHistory: [...] // Previous messages
}
```

**Context to fetch**:
```javascript
// All projects
const projects = await getProjectsByUserId(userId);

// All agents (tactical workers)
const agents = await getAgentsByUserId(userId);

// All open actions across all agents
const allActions = await getActionsByUserId(userId);
const openActions = allActions.filter(a =>
  ['defined', 'scheduled', 'in_progress'].includes(a.state)
);

// Recent work logs
const workLogs = await getWorkLogsByUserId(userId);
const recentWorkLogs = workLogs.slice(0, 10);

// EA's context notes (if any)
const contextNotes = await getNotesByType(userId, 'context');
```

**System prompt**:
```javascript
const projectsContext = projects.map(p => `- ${p.name}: ${p.goal}`).join('\n');
const agentsContext = agents.filter(a => a.status === 'active').map(a =>
  `- ${a.name}: ${a.instructions?.goal || 'No goal'}`
).join('\n');

// Group actions by agent
const actionsByAgent = {};
openActions.forEach(a => {
  const agentName = agents.find(ag => ag.id === a.agentId)?.name || 'Unassigned';
  if (!actionsByAgent[agentName]) actionsByAgent[agentName] = [];
  actionsByAgent[agentName].push({ id: a.id, title: a.title, priority: a.priority, state: a.state });
});

const workLogsContext = recentWorkLogs.map(w =>
  `- ${w.title}${w.projectId ? ` (${projects.find(p => p.id === w.projectId)?.name || 'Unknown'})` : ''}`
).join('\n');

const systemPrompt = `You are an executive assistant with visibility across all projects and work.

YOUR STANCE (critical):
- Observational, not directive: "I notice...", "I see...", "What I'm observing..."
- Calm, present, reflective
- Brief responses (2-3 sentences unless more is needed)
- Never cheerleading or pressuring
- Help the user notice patterns they might miss
- When they seem overwhelmed, help narrow to ONE thing

WHAT YOU SEE:

Projects:
${projectsContext || 'No projects yet'}

Active Agents (tactical workers):
${agentsContext || 'No active agents'}

Open Actions (${openActions.length} total):
${JSON.stringify(actionsByAgent, null, 2)}

Recent Work (what they've been doing):
${workLogsContext || 'No recent work logged'}

${contextNotes.length > 0 ? `YOUR NOTES (context you've saved):\n${contextNotes[0].content}` : ''}

YOUR CAPABILITIES:
- Notice patterns across projects (overlap, imbalance, neglect)
- Help prioritize when asked - but through questions, not mandates
- Surface what seems most alive or urgent
- Ask about energy level to calibrate suggestions
- Use notes tools to maintain evolving context about the user

CONTEXT MAINTENANCE:
Use notes tools to maintain a "User Context" note (type: "context"):
- Record observations about patterns, preferences, energy
- Update as you learn through conversation

CONVERSATIONAL APPROACH:
- Start sessions with observation + open question
- Examples: "What feels most alive right now?", "Where's your energy today?"
- When overwhelmed, help narrow to ONE thing
- Respect "later" - don't pressure immediate action`;
```

**Tools available**:
- `create_note`, `get_notes`, `update_note` - for context maintenance
- Future: ability to create actions, dispatch agents

**Response**:
```javascript
{
  success: true,
  message: "EA response text...",
  usage: { inputTokens, outputTokens }
}
```

## Verification

1. **Test project endpoints**:
```bash
# Create project
curl -X POST http://localhost:8888/.netlify/functions/project-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","name":"Career Launch","goal":"Get a job by March"}'

# List projects
curl "http://localhost:8888/.netlify/functions/project-list?userId=u-test"
```

2. **Test work log endpoints**:
```bash
# Submit work log
curl -X POST http://localhost:8888/.netlify/functions/work-log-submit \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","title":"Worked on resume","duration":45}'

# List work logs
curl "http://localhost:8888/.netlify/functions/work-log-list?userId=u-test"
```

3. **Test EA chat endpoint**:
```bash
# Chat with EA
curl -X POST http://localhost:8888/.netlify/functions/do-chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test","message":"What should I work on today?","chatHistory":[]}'
```

Verify EA response:
- Sees all projects in context
- Sees actions across all agents
- Uses observational language ("I notice...", "I see...")
- Brief, calm, not cheerleading

## Files to Create

| File | Purpose |
|------|---------|
| `netlify/functions/_services/db-projects.cjs` | Projects data layer |
| `netlify/functions/_services/db-work-logs.cjs` | Work logs data layer |
| `netlify/functions/project-list.js` | List projects endpoint |
| `netlify/functions/project-create.js` | Create project endpoint |
| `netlify/functions/work-log-submit.js` | Submit work log |
| `netlify/functions/work-log-list.js` | List work logs |
| `netlify/functions/do-chat.js` | EA chat endpoint (dedicated) |

## Files NOT Modified

`agent-chat.js` remains unchanged - it stays focused on tactical agent work. EA gets its own dedicated endpoint.

## Success Criteria

- [ ] Can create and list projects via API
- [ ] Can submit and list work logs via API
- [ ] EA chat endpoint returns responses
- [ ] EA sees all projects in context
- [ ] EA sees actions across all agents
- [ ] EA uses observational language ("I notice...", "I see...")
