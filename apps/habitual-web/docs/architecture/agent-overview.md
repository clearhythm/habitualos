# Strategic Context for Claude Code Prompts

When generating Claude Code prompts, provide strategic direction while deferring implementation details.

## HabitualOS Architecture Patterns

**Authentication & Authorization:**
- User IDs: `u-{timestamp}-{random}` stored in localStorage
- All queries filtered by `_userId` for data isolation
- Verify ownership: `if (!resource || resource._userId !== userId) { return 404; }`

**Data Layer (Service Pattern):**
- All Firestore operations through `_services/db-*.cjs`
- Standard exports: `create{Item}`, `get{Item}`, `getAll{Items}`, `update{Item}`
- Examples: db-agents.cjs, db-actions.cjs, db-practice-logs.cjs

**ID Formats:**
- Agents: `agent-{random}`
- Actions: `action-{timestamp}-{random}`
- Practice logs: `p-{timestamp}-{random}`
- Assets: `asset-{timestamp}-{random}`

**API Endpoint Pattern:**
- Location: `netlify/functions/*.js`
- Structure: Validate method → Parse input → Call service → Return JSON
- Always validate userId format and resource ownership

**Frontend Architecture:**
- 11ty static site generator with Nunjucks templates
- Pages: `src/do/` (agents), `src/practice/` (tracker)
- Client JS uses fetch() to call Netlify functions
- Deployed on Netlify (read-only filesystem at runtime)

## Generating Claude Code Prompts

**Prompt Structure (WHAT/WHERE/HOW):**
1. **WHAT**: Clear objective (feature/bug/refactor)
2. **WHERE**: Key file locations to explore/modify
3. **HOW (Deferred)**: "Research [pattern/file] and follow those patterns"
4. **CONSTRAINTS**: Specific requirements or limitations

**Good Examples:**

"Add pagination to the agents list endpoint. Research the existing query patterns in netlify/functions/_services/db-agents.cjs and implement pagination following Firestore's standard patterns. Update the frontend in src/do/agents.njk to display pagination controls."

"Create endpoint to archive completed actions. Follow the pattern in netlify/functions/action-complete.js for state transitions, use service layer in _services/db-actions.cjs. Ensure proper userId validation following security.md patterns."

**Bad Examples (Too Prescriptive):**
- "Add pagination using offset/limit with these parameter names..." ❌

**Bad Examples (Too Vague):**
- "Add pagination to agents" (missing WHERE and HOW) ❌

## Key File Locations

**Agent System:**
- Service: _services/db-agents.cjs
- Chat endpoint: netlify/functions/agent-chat.js
- UI: src/do/agent.njk, src/scripts/agent.js

**Actions System:**
- Service: _services/db-actions.cjs
- Endpoints: netlify/functions/action-*.js
- Modal: src/assets/js/components/action-modal.js

## Agent Chat Action Context

The agent chat system has full action awareness:

**System Prompt Includes:**
- Open actions list (states: defined, scheduled, in_progress) cached per session
- Current action context when navigating from Chat button

**Available Tools:**
- `get_action_details(action_id)` - Retrieve full action record
- `update_action(action_id, updates)` - Update title, description, priority, taskConfig

**Caching Strategy:**
- Block 1: Per-message action context (uncached)
- Block 2: System prompt + agent overview (cached)
- Block 3: Actions list snapshot (cached per session)

**Practice System:**
- Service: _services/db-practice-logs.cjs
- Chat endpoint: netlify/functions/practice-chat.js
- UI: src/practice/tracker.njk

**Documentation:**
- Architecture: docs/architecture/*.md
- Endpoints: docs/endpoints/*.md
