# Recent Changes


## Commit 6550db1 - 2026-01-08

**Author:** Erik Burns

**Message:**
Implement self-updating documentation with frontmatter staleness tracking

- Add frontmatter to ARCHITECTURE.md and DESIGN.md with last_sync, last_commit, commits_since_sync
- Update post-commit hook to increment commits_since_sync and update last_commit on each commit
- Update context-sync.js to preserve last_commit, reset commits_since_sync to 0, update last_sync
- Update agent-chat.js to parse frontmatter and prompt agent based on staleness:
  * 3+ commits: proactively suggest documentation update
  * 1-2 commits: mention casually without blocking conversation
- Delete obsolete .context-sync-status.json file

Agents can now intelligently detect when documentation is out of date and proactively suggest updates, creating a self-maintaining documentation system.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

**Changed files:**
- .context-sync-status.json
- ARCHITECTURE.md
- CHANGELOG_RECENT.md
- DESIGN.md
- netlify/functions/agent-chat.js
- scripts/context-sync.js

---

## Commit 1821aa1 - 2026-01-08

**Author:** Erik Burns

**Message:**
Add prompt caching to reduce API costs by ~90%

- Update agent-chat.js to use prompt caching for system prompt
- Update context-sync.js to use prompt caching for synthesis instructions
- System prompts now cached with ephemeral cache_control
- First call pays full cost, subsequent calls in 5-minute window pay ~10% for cached portion
- Massive cost reduction for conversational agent chats that include ARCHITECTURE.md + DESIGN.md context (~10k tokens cached)

This enables sustainable design discussions via API without hitting rate limits.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

**Changed files:**
- ARCHITECTURE.md
- CHANGELOG_RECENT.md
- DESIGN.md
- netlify/functions/agent-chat.js
- scripts/context-sync.js

---

## Commit deb0ec4 - 2026-01-08

**Author:** Erik Burns

**Message:**
adding agent chat functions to create assets and action cards depending on the context

**Changed files:**
- ARCHITECTURE.md
- CHANGELOG_RECENT.md
- DESIGN.md
- netlify/functions/action-define.js
- netlify/functions/agent-chat.js
- src/do/agent.njk

---

## Commit d10316c - 2026-01-10

**Author:** Erik Burns

**Message:**
Add MCP-adjacent tool registry system for agent capabilities

Implements a declarative tool registry that allows agents to perform
operations beyond generating deliverables (actions/assets). Architecture
is compatible with Model Context Protocol (MCP) but works serverless.

## New Architecture Components

### Tool Registry (netlify/functions/_tools/registry.cjs)
- Declarative tool definitions with MCP-compatible schemas
- Each tool has: name, description, inputSchema, handler
- Central registry makes adding new tools simple
- Can be converted to actual MCP server in future

### Tool Implementation Pattern (netlify/functions/_tools/sync-documentation.cjs)
- Each tool is a module exporting execute(input) function
- Wraps existing scripts/operations with structured I/O
- Returns success/failure with detailed results
- First tool: sync_documentation (runs context-sync.js)

### Agent Integration (netlify/functions/agent-chat.js)
- System prompt includes available tools documentation
- Agents signal tool usage: USE_TOOL: tool_name
- Backend detects signal, routes to registry, executes tool
- Tool results returned to conversation for agent awareness

## Why This Approach

1. **MCP-Adjacent**: Schema and patterns align with MCP standard
2. **Serverless Compatible**: Works with Netlify Functions today
3. **Extensible**: Adding tools = adding to registry
4. **Future-Proof**: Can become actual MCP server when needed
5. **Clean Separation**: Tools don't pollute main agent logic

## Current Capability

Agents can now:
- Detect when documentation is stale (existing capability)
- Autonomously sync documentation via sync_documentation tool
- See tool results and continue conversation naturally

## Future Tools

Registry pattern supports adding:
- generate_shift_cards (PDF generation)
- query_actions (search existing actions)
- query_assets (search existing assets)
- External integrations (GitHub, databases, etc.)

This establishes the foundation for agent capabilities beyond
just generating deliverables.

**Changed files:**
- netlify/functions/_tools/registry.cjs
- netlify/functions/_tools/sync-documentation.cjs
- netlify/functions/agent-chat.js

---

## Commit 7308422 - 2026-01-10

**Author:** Erik Burns

**Message:**
Update documentation to reflect Firestore database migration

Removes outdated SQLite references and updates all documentation
to accurately reflect current Firestore architecture.

Changes:
- ARCHITECTURE.md: Updated tech stack, data flow, deployment config
- DESIGN.md: Marked db/ directory as deprecated/legacy
- README.md: Changed from "Turso (edge SQLite)" to "Firestore"
- PRACTICE_TRACKER.md: Updated data persistence references

All documentation now correctly states that HabitualOS uses
Firestore (Firebase NoSQL) for persistent cloud storage.

**Changed files:**
- ARCHITECTURE.md
- DESIGN.md
- PRACTICE_TRACKER.md
- README.md

---

## Commit d0d29e4 - 2026-01-10

**Author:** Erik Burns

**Message:**
Add delete buttons to draft action and proposed asset modals

Users can now delete unwanted draft actions and proposed assets
directly from their modals instead of having them stuck in the queue.

Changes:
- Added delete button to draft action modal (red, left-aligned)
- Added delete button to proposed asset modal (red, left-aligned)
- Implemented deleteDraftAction() function
- Implemented deleteProposedAsset() function
- Both functions show confirmation dialog before deletion
- Removes items from localStorage and DOM immediately
- Wired up event listeners for new delete buttons

Modal layout: Delete button on left, action buttons on right
Styling: Red background (#fee2e2) to indicate destructive action

**Changed files:**
- src/do/agent.njk

---

## Commit e769ffa - 2026-01-10

**Author:** Erik Burns

**Message:**
Improve agent creation flow with better goal framing and timeline flexibility

Updates the setup-chat conversational flow to frame goals as what
the agent IS and DOES, plus support for ongoing (indefinite) agents.

Changes to system prompt:
1. Goal Framing Guidance
   - Frame as "A [type] agent that [does what]"
   - Examples: "A strategic architecture agent that generates prompts"
   - Avoid: "Create an agent for..." phrasing

2. Timeline Flexibility
   - Time-bound: Specific deadline or date range
   - Ongoing: No end date, continuous work
   - Examples of ongoing: design discussion, content generation, research

3. Updated Example
   - Changed from "Build and deploy..." to "A goal-oriented productivity agent that..."
   - Added note about "Ongoing" timeline option

Result: Agents now have clear identity statements and can be
indefinite/ongoing rather than always time-bound.

Example before: "Create an agent for having strategic conversations"
Example after: "A strategic architecture agent that generates actionable prompts"

**Changed files:**
- netlify/functions/setup-chat.js

---

## Commit 9e7705e - 2026-01-10

**Author:** Erik Burns

**Message:**
Add script to update HabitualOS Design Agent with new framing

One-time migration script that updates the existing design agent to
use the new goal framing pattern and sets timeline to "Ongoing".

Updates:
- Name: "HabitualOS Design Agent" → "HabitualOS Architecture Agent"
- Goal: Reframed from "Create an agent for..." to "A strategic architecture agent that..."
- Timeline: "Launch immediately" → "Ongoing"

This script was used to migrate the existing agent and demonstrates
the new framing pattern introduced in the setup-chat improvements.

**Changed files:**
- scripts/update-design-agent.js

---
