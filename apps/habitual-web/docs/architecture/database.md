# Database Schema

All data stored in Google Firestore.

## Collections

### agents
Autonomous AI assistants for specific goals.

```javascript
{
  id: "agent-{random}",              // Primary key
  _userId: "u-{timestamp}-{random}",
  name: string,
  status: "active" | "paused" | "archived",
  model: string,                      // e.g., "claude-sonnet-4-20250514"
  instructions: {
    goal: string,                     // "A [type] agent that [does what]"
    success_criteria: string,
    timeline: string                  // Specific date or "Ongoing"
  },
  metrics: {
    totalCost: number,
    completedActions: number,
    totalActions: number
  },
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

### agent_creation_chats
Conversation history from agent setup flow.

```javascript
{
  id: "agcc-{timestamp}-{random}",   // Primary key
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  messages: [{
    role: "user" | "assistant",
    content: string,
    timestamp: string
  }],
  _createdAt: Timestamp
}
```

### agent_chats
Conversation history for deliverable generation and refinement.

```javascript
{
  id: "agc-{timestamp}-{random}",    // Primary key
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  messages: [{
    role: "user" | "assistant",
    content: string,
    timestamp: string
  }],
  generatedAssets: string[],         // Asset IDs created in this session
  generatedActions: string[],        // Action IDs created in this session
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

**Lifecycle:**
- Created when first deliverable generated
- Appended during refinements
- Cleared when deliverable approved/persisted

### actions
Deliverables including scheduled work, interactive tasks, and immediate content (formerly assets).

```javascript
{
  id: "action-{timestamp}-{random}", // Primary key
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  title: string,
  description: string,
  state: "draft" | "defined" | "scheduled" | "in_progress" | "completed" | "dismissed",
  priority: "high" | "medium" | "low",
  taskType: "interactive" | "scheduled" | "manual",
  scheduleTime: string | null,       // ISO timestamp
  startedAt: string | null,
  completedAt: string | null,
  dismissedAt: string | null,
  dismissedReason: string | null,
  errorMessage: string | null,
  taskConfig: {                      // For autonomous execution (scheduled/interactive only)
    instructions: string,            // Detailed steps
    expectedOutput: string,          // What artifacts to produce
    context: object                  // Additional data
  },
  type: string | null,               // For manual tasks: "prompt", "code", "document", etc.
  content: string | null,            // For manual tasks: full deliverable content
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

**Task Types:**
- `interactive`: Tasks requiring human interaction
- `scheduled`: Autonomous tasks executed at scheduled time
- `manual`: Immediate deliverables with full content (formerly assets)

**State transitions:**
```
draft (localStorage)
  → [action-define] →
defined (database, ready for scheduling)
  → [scheduler] →
scheduled → in_progress → completed
                    ↓
                dismissed
```

### assets (DEPRECATED - now part of actions)
Assets have been merged into the actions collection as taskType: "manual".
See actions schema above for the unified model.

### task_outputs
Results from scheduled task execution.

```javascript
{
  id: "task-output-{timestamp}-{random}",
  taskId: string,
  actionId: "action-{timestamp}-{random}",
  output: string,                    // Generated content/artifacts
  status: "success" | "error",
  _createdAt: Timestamp
}
```

### agent-drafts
Content drafts that discovery agents produce for user review.

```javascript
{
  id: "draft-{random}",
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",           // Source discovery agent
  type: "company" | "person" | "article" | "job",
  status: "pending" | "reviewed" | "committed",
  data: {                               // Type-specific payload
    name: "Spring Health",
    domain: "springhealth.com",
    // ...
  },
  review: {                             // Populated when user reviews
    score: 7,                           // 0-10 user fit assessment
    feedback: "Love the mission...",
    status: "accepted" | "rejected",    // accepted (score>=5) | rejected (score<5)
    user_tags: ["great-mission"],
    reviewedAt: "2026-02-13T..."
  },
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

**Status flow:** `pending` → `reviewed` → `committed`

User review data is stored in the `review` field on the draft itself. Fox-EA presents drafts one-by-one and records feedback via `submit_draft_review`.

### preference-profiles
Structured preference profiles generated from review feedback.

```javascript
{
  id: "pref-{agentId}",                // One per discovery agent
  _userId: "u-{timestamp}-{random}",
  agentId: "agent-{random}",
  profile: {
    summary: "Looking for early-stage health/wellness companies...",
    likes: ["mission-driven", "coaching/wellness"],
    dislikes: ["adtech", "crypto"],
    dealBreakers: ["fully onsite"],
    patterns: "Consistently scores coaching companies 8+..."
  },
  reviewCount: 15,
  _updatedAt: Timestamp
}
```

Regenerated after each review session completes. Used by discovery pipeline to refine search queries.

### practice-logs
Individual practice check-in records (Practice system).

```javascript
{
  id: "p-{timestamp}-{random}",
  _userId: "u-{timestamp}-{random}",
  practice_name: string | null,      // Optional
  duration: number | null,           // Minutes
  reflection: string | null,
  obi_wan_message: string | null,    // Short wisdom
  obi_wan_expanded: string | null,   // Long wisdom
  obi_wan_feedback: "thumbs_up" | "thumbs_down" | null,
  timestamp: string,                 // ISO timestamp
  _createdAt: Timestamp
}
```

### practices
Practice definitions and metadata (Practice system).

```javascript
{
  id: "practice-{random}",
  _userId: "u-{timestamp}-{random}",
  name: string,                      // Original casing preserved
  instructions: string,              // Latest from chat
  checkins: number,                  // Counter
  _createdAt: Timestamp,
  _updatedAt: Timestamp | null
}
```

### practice-chats
Saved conversations for practice discovery (Practice system).

```javascript
{
  id: "pc-{timestamp}-{random}",
  _userId: "u-{timestamp}-{random}",
  messages: [{
    role: "assistant" | "user",
    content: string,
    timestamp: string
  }],
  suggestedPractice: string | null,
  fullSuggestion: string | null,
  completed: boolean,
  savedAt: string,
  _createdAt: Timestamp
}
```

## ID Format Conventions

- **Users**: `u-{timestamp}-{random}`
- **Agents**: `agent-{random}`
- **Actions**: `action-{timestamp}-{random}`
- **Assets**: `asset-{timestamp}-{random}`
- **Agent Creation Chats**: `agcc-{timestamp}-{random}`
- **Agent Chats**: `agc-{timestamp}-{random}`
- **Practice Logs**: `p-{timestamp}-{random}`
- **Practices**: `practice-{random}`
- **Practice Chats**: `pc-{timestamp}-{random}`
- **Task Outputs**: `task-output-{timestamp}-{random}`
- **Drafts**: `draft-{random}`
- **Preference Profiles**: `pref-{agentId}`

## Common Patterns

### User ID Filtering
All queries filtered by `_userId` for data isolation:
```javascript
const snapshot = await db.collection('agents')
  .where('_userId', '==', userId)
  .get();
```

### Timestamps
- `_createdAt`: Firestore server timestamp on creation
- `_updatedAt`: Firestore server timestamp on update
- Other timestamps: ISO string format

### Case-Insensitive Lookups
Firestore doesn't support case-insensitive queries, so:
- Store original casing
- Query all documents
- Filter in JavaScript with `.toLowerCase()`

Example (practice names):
```javascript
const allPractices = await getAllPractices(userId);
const match = allPractices.find(p =>
  p.name.toLowerCase() === searchName.toLowerCase()
);
```

## Service Layer

All database operations go through service modules in:
`netlify/functions/_services/db-*.cjs`

Standard exports:
- `create{Item}(id, data)` - Create document
- `get{Item}(id)` - Get single document
- `getAll{Items}(userId)` - Get all user's documents
- `update{Item}(id, data)` - Update document
- `delete{Item}(id)` - Delete document
