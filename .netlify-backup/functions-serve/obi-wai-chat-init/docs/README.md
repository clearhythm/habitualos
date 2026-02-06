# HabitualOS Documentation

Contract-focused documentation for the HabitualOS codebase.

## Structure

### `/architecture/`
High-level system design and patterns:
- [overview.md](architecture/overview.md) - System purpose, two systems (Agents + Practice), user journey
- [agents.md](architecture/agents.md) - Agent system: agents, assets, actions, chats, signals, tools
- [database.md](architecture/database.md) - Complete database schema for all collections
- [security.md](architecture/security.md) - Authentication, authorization, input validation
- [practice-tracker.md](architecture/practice-tracker.md) - Practice system overview
- [practice.md](architecture/practice.md) - Complete practice tracker documentation

### `/endpoints/`
API endpoint contracts (request/response shapes, behavior):
- [agent-chat.md](endpoints/agent-chat.md) - POST /api/agent-chat
- [action-define.md](endpoints/action-define.md) - POST /api/action-define

## Documentation Principles

**Contract-focused, not implementation-heavy**
- Document external behavior, not internal details
- Show request/response shapes
- Describe key behaviors and data flow
- Link to related files for implementation

**Update with code changes**
- Update docs in the same commit as code changes
- Only for: new endpoints, contract changes, architecture changes, breaking changes
- Skip for: bug fixes, refactoring, UI tweaks, performance optimizations

**Keep concise**
- Each doc should be scannable in 2-3 minutes
- Use bullet points and code examples
- No unnecessary prose

## Reading After Context Clear

1. Start with [CLAUDE.md](../CLAUDE.md) for development workflow
2. Read [architecture/overview.md](architecture/overview.md) for system understanding
3. Read specific architecture or endpoint docs as needed

## Root Documentation

- [CLAUDE.md](../CLAUDE.md) - Working with Claude Code, development workflow
- [deployment.md](deployment.md) - Deployment guide for local and production
