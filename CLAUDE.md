# Working with Claude Code on HabitualOS

## Quick Start After Context Clear

1. Read this file (CLAUDE.md)
2. Read relevant docs from `docs/architecture/` and `docs/endpoints/`
3. You now have current system context

## Documentation Maintenance Rules

**ALWAYS update docs for:**
- New API endpoints or endpoint contract changes
- New features or major functionality changes
- Architecture changes (new collections, data flow modifications)
- Breaking changes to existing behavior

**SKIP docs for:**
- Bug fixes (unless they change external behavior)
- Internal refactoring (same external interface)
- UI tweaks, styling changes
- Performance optimizations
- Error message improvements

**Documentation structure:**
- `docs/architecture/` - High-level system design and patterns
- `docs/endpoints/` - API contracts (request/response shapes, behavior)
- Keep docs contract-focused, not implementation-heavy
- Update docs in the same commit as code changes

## Project Architecture

### Two Distinct Systems

**Agents System** (`src/do/`, `netlify/functions/agent-*`)
- Task/action management
- Conversational interfaces for creating actions
- Autonomous execution and scheduling
- Agent definitions and chat history

**Practice System** (`src/practice/`, `netlify/functions/practice-*`)
- Obi-Wai habit tracker
- Practice logging and wisdom generation
- Garden visualization
- Practice discovery through chat

### Technology Stack

- **Frontend**: 11ty static site generator, Nunjucks templates
- **Backend**: Netlify serverless functions (Node.js)
- **Database**: Google Firestore
- **AI**: Claude API (Anthropic SDK)
- **Deployment**: Netlify (git-based, read-only filesystem at runtime)

### Key Patterns

**Authentication**
- Client-side user IDs: `u-{timestamp}-{random}`
- Stored in localStorage with sessionStorage fallback
- All queries filtered by `_userId`

**Data Layer**
- Service layer in `netlify/functions/_services/*.cjs`
- All Firestore operations go through services
- Common services: `db-agents.cjs`, `db-actions.cjs`, `db-practice-logs.cjs`

**ID Formats**
- Agents: `agent-{random}`
- Actions: `action-{timestamp}-{random}`
- Practice logs: `p-{timestamp}-{random}`
- Practices: `practice-{random}`
- Users: `u-{timestamp}-{random}`

**Agent Signals**
Agents communicate intent via structured responses:
- `GENERATE_ACTIONS` - Agent wants to create a scheduled action
- `GENERATE_ASSET` - Agent wants to create an immediate deliverable (manual action)
- `STORE_MEASUREMENT` - Agent has collected measurement check-in data

**Agent Tools**
Agents have access to tools for action management:
- `get_action_details` - Retrieve full action record
- `update_action` - Update title, description, priority, taskConfig

## Code Style Principles

**Avoid Over-Engineering**
- No premature abstractions
- Don't create helpers for one-time operations
- Don't add configurability for hypothetical future requirements
- Three similar lines are better than a premature abstraction

**Minimal Changes**
- Only make changes directly requested or clearly necessary
- Bug fix doesn't need surrounding code cleanup
- Don't add comments/docstrings to unchanged code
- Don't add error handling for scenarios that can't happen

**Trust Internal Code**
- Only validate at system boundaries (user input, external APIs)
- Trust framework guarantees and internal code
- Avoid backwards-compatibility hacks (if unused, delete it)

**Security**
- Be careful of command injection, XSS, SQL injection, OWASP top 10
- If you write insecure code, immediately fix it
- Validate and escape user input at boundaries

## Git Workflow

**Commits**
- Use Claude Code co-author footer
- Docs updated in same commit as code changes (for significant changes)
- Standard commit workflow - no hooks or automation
- **Always commit work at end of session** - prevents losing context and tracks progress
- Rough commit messages are fine if precise description would take too long

**Deployment**
- Git push triggers Netlify deploy
- Functions can read deployed files but cannot write
- Environment variables in `.env` (local) and Netlify dashboard (remote)

## Common Patterns

**Endpoint Structure**
```javascript
/**
 * POST /api/endpoint-name
 *
 * Brief description of what this endpoint does.
 * See: docs/endpoints/endpoint-name.md
 */
exports.handler = async (event) => {
  // Validate HTTP method
  // Parse and validate input
  // Call service layer
  // Return structured response
};
```

**Service Layer Pattern**
```javascript
// netlify/functions/_services/db-collection.cjs
async function getItem(id) {
  const docRef = db.collection('items').doc(id);
  const docSnap = await docRef.get();
  return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
}
```

**Frontend Data Fetching**
```javascript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, ...data })
});
const result = await response.json();
```

## Debugging Tips

**Local Development**
- `npm run dev` - Start 11ty dev server
- `npm run serve` - Serve built site
- Netlify functions run via Netlify Dev (if configured)

**Common Issues**
- Functions can't write files on Netlify (use Firestore)
- Check `.env` for required API keys
- Firestore queries can't do case-insensitive matches (do in JS)
- 11ty templates cache aggressively (restart dev server)

## Working with User

**Communication Style**
- Short, concise responses
- No unnecessary superlatives or emotional validation
- Professional objectivity over false agreement
- Output text directly, never use bash echo to communicate

**Planning**
- Use TodoWrite for complex multi-step tasks
- Mark todos in_progress before starting work
- Mark completed immediately after finishing
- Provide concrete implementation steps, no time estimates

**Asking Questions**
- Use AskUserQuestion when clarification needed
- Don't present time estimates when showing options
- Focus on what each option involves, not how long it takes

## Token Management

**Context Efficiency**
- Aggressive context clearing is encouraged
- Rebuild understanding from CLAUDE.md + modular docs quickly
- Use specialized tools (Read, Grep, Glob) instead of bash when possible
- Run independent tool calls in parallel when possible

**When to Use Task Tool**
- Open-ended codebase exploration
- Complex multi-file searches
- When you'd need multiple rounds of grep/glob
- NOT for reading a specific known file path
- NOT for searching within 2-3 specific files

## Important Notes

- **Never** commit `.env` or credentials
- **Never** use `git commit --amend` unless specific conditions met (see git safety protocol)
- **Never** create markdown docs unless explicitly needed for the task
- **Always** read files before editing them
- **Always** use dedicated file tools (Read/Edit/Write) instead of bash cat/sed/echo
