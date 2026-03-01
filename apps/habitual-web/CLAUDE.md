# habitual-web — Claude Context

Standalone Netlify app. Full-featured HabitualOS: agents, actions, practice system.

## Quick Start

1. Read root `CLAUDE.md` (monorepo conventions)
2. Read `docs/architecture/` for system design
3. Read `docs/endpoints/` for API contracts

## Documentation Maintenance

**Update docs for:** new/changed API endpoints, new features, architecture changes, breaking changes.
**Skip docs for:** bug fixes, internal refactoring, UI tweaks, performance, error messages.

Docs live in:
- `docs/architecture/` — system design and data flow
- `docs/endpoints/` — API contracts (request/response shapes)
- Update docs in the same commit as the code change.

## Architecture: Two Systems

**Agents System** (`src/do/`, `netlify/functions/agent-*`)
- Task/action management with conversational creation
- Autonomous execution and scheduling
- Agent definitions and chat history

**Practice System** (`src/practice/`, `netlify/functions/practice-*`)
- Obi-Wai habit tracker (legacy — standalone version is `apps/obi-wai-web`)
- Practice logging, wisdom generation, garden visualization

## Key Patterns

**ID Formats**
- Agents: `agent-{random}`
- Actions: `action-{timestamp}-{random}`
- Practice logs: `p-{timestamp}-{random}`
- Practices: `practice-{random}`
- Users: `u-{timestamp}-{random}`

**Agent Signals** (structured text responses Claude emits)
- `GENERATE_ACTIONS` — agent wants to create a scheduled action
- `GENERATE_ASSET` — agent wants to create an immediate deliverable
- `STORE_MEASUREMENT` — agent has collected measurement check-in data

**Agent Tools** (Claude API tool use)
- `get_action_details` — retrieve full action record
- `update_action` — update title, description, priority, taskConfig

## Local Development

```
npm run dev       # 11ty dev server
npm run serve     # serve built site
```

Functions run via Netlify Dev. Restart dev server if 11ty templates cache stale content.
