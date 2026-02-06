# Agent-Notes.md

## Context / Intent

I need a **living documentation system** to support my career-coaching / job-search work (companies I’m researching, job listings, article stubs, notes, evolving strategy). This system should behave similarly to how my architecture docs work today: it evolves over time, reflects decisions as they are made, and becomes more valuable the longer I use it.

A core constraint is that this content is **deeply personal** and **not public-repo material**, but I still need **mobile access** for lightweight interactions.

---

## Core Tension

I want:
- **Local-first, rich documents** (Markdown on disk) for deep thinking and long-form work
- **Mobile access** for quick captures (save a URL, jot a thought, check something off)

Trying to fully sync rich Markdown documents through serverless APIs feels wrong:
- DBs are annoying for Markdown-heavy content
- Serverless timeouts make file transfer brittle
- I don’t need full editing on mobile — just capture and review

---

## Resolved Approach (Hybrid by Access Pattern)

I want to split the system by **how the content is used**, not by concept.

### 1. Rich / Heavy Documents (Localhost only)

Examples:
- Deep company research
- Strategy memos
- Article drafts
- Long-form notes

Characteristics:
- Live on the **local filesystem**
- Stored under `/data/...`
- **Gitignored**
- Read/written by agents during localhost chat sessions

---

### 2. Quick-Capture Items (Mobile-enabled)

Examples:
- Job listing URLs
- Company bookmarks
- Small notes or observations
- Lightweight check-offs

Characteristics:
- Stored online in a **DB collection**
- Can be added/viewed from mobile via simple UI
- Optimized for fast capture, not deep editing

---

### Agent as the Bridge

When I’m back on localhost, the agent can:
- Pull recent quick-captures from the DB
- Summarize them
- Ask whether to merge them into rich Markdown docs
- Write them into the filesystem if approved

The **agent acts as the bridge** between DB and filesystem during localhost sessions.

---

## Abstraction for Reuse

This system should not be career-specific. Other agents may want the same pattern.

### DB Collection

- Collection name: **`agent-notes`**
- Each note is associated with an `agentId`
- Lightweight, structured data

Example fields:
- `agentId`
- `type`
- `title` / `content`
- `metadata` (e.g. `url`, `tags`)
- `userId`
- `createdAt`, `updatedAt`

### Example Use Cases

- Career agent → job links, company bookmarks
- Writing agent → article ideas
- Finance agent → receipts, quick expense notes
- Any future agent needing mobile capture + local deep work

---

## Local Filesystem Convention

Local data should be easy for me to scan and reason about.

### Directory Pattern

# Agent-Notes.md

## Context / Intent

I need a **living documentation system** to support my career-coaching / job-search work (companies I’m researching, job listings, article stubs, notes, evolving strategy). This system should behave similarly to how my architecture docs work today: it evolves over time, reflects decisions as they are made, and becomes more valuable the longer I use it.

A core constraint is that this content is **deeply personal** and **not public-repo material**, but I still need **mobile access** for lightweight interactions.

---

## Core Tension

I want:
- **Local-first, rich documents** (Markdown on disk) for deep thinking and long-form work
- **Mobile access** for quick captures (save a URL, jot a thought, check something off)

Trying to fully sync rich Markdown documents through serverless APIs feels wrong:
- DBs are annoying for Markdown-heavy content
- Serverless timeouts make file transfer brittle
- I don’t need full editing on mobile — just capture and review

---

## Resolved Approach (Hybrid by Access Pattern)

I want to split the system by **how the content is used**, not by concept.

### 1. Rich / Heavy Documents (Localhost only)

Examples:
- Deep company research
- Strategy memos
- Article drafts
- Long-form notes

Characteristics:
- Live on the **local filesystem**
- Stored under `/data/...`
- **Gitignored**
- Read/written by agents during localhost chat sessions

---

### 2. Quick-Capture Items (Mobile-enabled)

Examples:
- Job listing URLs
- Company bookmarks
- Small notes or observations
- Lightweight check-offs

Characteristics:
- Stored online in a **DB collection**
- Can be added/viewed from mobile via simple UI
- Optimized for fast capture, not deep editing

---

### Agent as the Bridge

When I’m back on localhost, the agent can:
- Pull recent quick-captures from the DB
- Summarize them
- Ask whether to merge them into rich Markdown docs
- Write them into the filesystem if approved

The **agent acts as the bridge** between DB and filesystem during localhost sessions.

---

## Abstraction for Reuse

This system should not be career-specific. Other agents may want the same pattern.

### DB Collection

- Collection name: **`agent-notes`**
- Each note is associated with an `agentId`
- Lightweight, structured data

Example fields:
- `agentId`
- `type`
- `title` / `content`
- `metadata` (e.g. `url`, `tags`)
- `userId`
- `createdAt`, `updatedAt`

### Example Use Cases

- Career agent → job links, company bookmarks
- Writing agent → article ideas
- Finance agent → receipts, quick expense notes
- Any future agent needing mobile capture + local deep work

---

## Local Filesystem Convention

Local data should be easy for me to scan and reason about.

### Directory Pattern

/data/{agentName}-{agentId}/

Example:
/data/career-agent-abc123/agent-summary.md // this file will be kept up to date and always get read into ephemeral cached content at the start of agent chat session
/data/career-agent-abc123/companies.md // specific file(s) created during work and updated as needed


### Notes

- `agentId` ensures uniqueness and stability
- `agentName` preserves human readability
- If an agent is renamed, the directory can remain unchanged

The agent’s config should store:
- `localDataPath` (relative to `/data/`)

---

## Capabilities-Based Agent Design

Agents should **not care about environment (dev/prod)** directly.  
They should adapt based on **which tools are available**.

### Agent Configuration

```json
{
  "localDataPath": "career-agent-abc123",
  "capabilities": {
    "filesystem": true,
    "noteCapture": true
  }
}
```

## Tool Exposure at Runtime

### On Localhost
- Filesystem tools:
  - read_file
  - write_file
  - list_files
- DB tools:
  - create_note
  - get_notes

### On Mobile / Production
- DB tools only:
  - create_note
  - get_notes

The orchestrator dynamically builds the tool list passed to the LLM based on runtime availability.

## Agent System Prompt Guidance

The agent system prompt should explicitly state:

“You have access to the following tools: [X].
Use filesystem tools for rich documents.
Use note-capture tools for quick items, especially when filesystem access is unavailable.”

This keeps agents:
- Environment-agnostic
- Extensible
- Easy to evolve with new capabilities (email, APIs, etc.)