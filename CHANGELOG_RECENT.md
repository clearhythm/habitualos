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

## Commit 8001c45 - 2026-01-10

**Author:** Erik Burns

**Message:**
Update documentation frontmatter after recent commits

**Changed files:**
- ARCHITECTURE.md
- CHANGELOG_RECENT.md
- DESIGN.md

---

## Commit 0212671 - 2026-01-10

**Author:** Erik Burns

**Message:**
Implement agent chat history persistence to Firestore

Agent work chats are now automatically saved to Firestore when
a deliverable (action or asset) is generated, preserving the
conversation context that led to creating each deliverable.

## Architecture

### Database Service (netlify/functions/_services/db-agent-chats.cjs)
- Collection: 'agent-chats'
- Schema: userId, agentId, messages[], generatedAssets[], generatedActions[]
- Methods: getAgentChatsByUserId(), getAgentChatsByAgentId(), createAgentChat()
- ID format: agc-{timestamp}-{random}

### Save Endpoint (netlify/functions/agent-chat-save.js)
- POST /api/agent-chat-save
- Validates required fields (userId, agentId, messages array)
- Saves chat with references to generated deliverables
- Returns chatId on success

### Frontend Integration (src/do/agent.njk)
- Added chatSavedToFirestore flag to prevent duplicate saves
- saveChatToFirestore() function handles async save operation
- Triggered when draft action is generated (passes action IDs)
- Triggered when proposed asset is generated (passes asset IDs)
- Only saves once per chat session (ephemeral until deliverable created)

## Behavior

1. Chat History Lifecycle:
   - Starts in memory only (ephemeral)
   - Saved to Firestore when first asset/action is generated
   - Subsequent messages in same session don't trigger new saves
   - Each new chat session (page reload) creates new potential save

2. What Gets Persisted:
   - Full message history (user + assistant)
   - IDs of assets generated in that session
   - IDs of actions generated in that session
   - User and agent context

3. Benefits:
   - Record of conversation context leading to deliverables
   - Debugging and refinement of agent behavior
   - Audit trail of work done
   - No chat history loss

This follows the pattern established by agent-creation-chats
but captures the ongoing work sessions rather than just the
initial setup conversation.

**Changed files:**
- netlify/functions/_services/db-agent-chats.cjs
- netlify/functions/agent-chat-save.js
- src/do/agent.njk

---

## Commit ac8696a - 2026-01-10

**Author:** Erik Burns

**Message:**
Fix agent chat persistence flow to support refinement cycles

Implements proper chat lifecycle: CREATE on first deliverable,
APPEND on refinements, CLEAR on approval.

## Previous Behavior (Bug)
- Chat saved once with chatSavedToFirestore flag
- Refinements not captured
- Chat history never cleared

## New Behavior (Correct)

### Chat Lifecycle
1. User chats → Agent generates deliverable
   - CREATE new chat in Firestore
   - Store chatId in memory
   - Keep chat in localStorage for refinements

2. User reviews → Closes without approving → Continues chatting
   - Agent refines deliverable
   - APPEND new messages to same chatId
   - Full conversation history preserved

3. User approves (Mark as Defined / Save to Assets)
   - Chat history cleared
   - UI reset with fresh greeting
   - currentChatId reset to null
   - Next deliverable creates new chat session

### Implementation Details

#### Frontend (src/do/agent.njk)
- Replaced chatSavedToFirestore flag with currentChatId tracking
- saveChatToFirestore() checks if currentChatId exists:
  - null → CREATE mode (new chat)
  - exists → APPEND mode (refinement)
- Added clearChatHistory() function:
  - Clears chatHistory array
  - Resets currentChatId to null
  - Clears chat UI
  - Renders fresh greeting
- Integrated clearChatHistory() in:
  - markAsDefinedFromModal() after success
  - saveAssetFromModal() after success

#### Service Layer (db-agent-chats.cjs)
- Added appendToAgentChat() function
- Fetches existing chat document
- Appends new messages to messages array
- Merges generatedAssets and generatedActions arrays
- Updates _updatedAt timestamp

#### Endpoint (agent-chat-save.js)
- Accepts mode parameter: 'create' or 'append'
- CREATE mode: Generates new chatId, creates document
- APPEND mode: Requires existing chatId, appends to document
- Returns chatId in both cases

This ensures complete conversation context is preserved through
multiple refinement cycles until the user approves the deliverable.

**Changed files:**
- netlify/functions/_services/db-agent-chats.cjs
- netlify/functions/agent-chat-save.js
- src/do/agent.njk

---

## Commit 897f353 - 2026-01-10

**Author:** Erik Burns

**Message:**
Clarify ASSET vs ACTION distinction in agent system prompt

Fix issue where agent incorrectly used GENERATE_ACTIONS for immediate
deliverables like specification documents that should be GENERATE_ASSET.

## Problem
Agent generated ACTION (future work) instead of ASSET (immediate deliverable)
when user requested "create a specification document". This resulted in:
- Only getting title/description instead of full content
- Wrong workflow (schedule later vs deliver now)

## Changes

### Before
- Vague distinction: "immediate" vs "future work"
- Examples didn't cover all common cases
- Not explicit about NOW vs LATER timing

### After
- Explicit: "deliver FULL CONTENT immediately" vs "done LATER at scheduled time"
- Added specific examples:
  * "Create a specification document" → ASSET (full spec content)
  * "Draft an email" → ASSET (full email text)
  * "Write code" → ASSET (complete code)
  * vs "Generate weekly posts" → ACTION (scheduled recurring)
- KEY RULE box emphasizing the distinction

## Expected Behavior
When user asks agent to create a spec doc, prompt, code snippet, etc.:
- Agent sends GENERATE_ASSET signal
- Asset includes full content in the response
- User can review/copy/save immediately

When user asks for scheduled/recurring work:
- Agent sends GENERATE_ACTIONS signal
- Action includes title/description/schedule
- Work executes at scheduled time

**Changed files:**
- netlify/functions/agent-chat.js

---

## Commit c50e624 - 2026-01-10

**Author:** Erik Burns

**Message:**
Add reset conversation button to agent chat interface

Adds manual reset button beneath chat input to allow users to
clear conversation history and start fresh.

## UI Change
- Added 'Reset Conversation' button below chat form
- Centered positioning with gray styling
- 🔄 icon for visual clarity

## Functionality
- Click button → Confirmation dialog
- Confirm → Calls clearChatHistory():
  * Clears chatHistory array
  * Resets currentChatId to null
  * Clears chat UI
  * Renders fresh greeting
- Next deliverable creates new chat session in Firestore

## Use Case
User wants to manually reset the conversation without approving
a deliverable. They can:
1. Delete draft actions/assets manually if needed
2. Click Reset Conversation
3. Confirm dialog
4. Start fresh conversation

Reuses existing clearChatHistory() function that was created
for the approval flow (Mark as Defined / Save to Assets).

**Changed files:**
- src/do/agent.njk

---

## Commit b50e374 - 2026-01-10

**Author:** Erik Burns

**Message:**
Fix signal parsing to prevent false matches in agent responses

Fixes bug where mentioning signal names in explanatory text would
trigger the wrong parser, causing 500 errors and empty deliverables.

## Problem
Agent responses like:
"I'll use GENERATE_ASSET instead of GENERATE_ACTIONS because..."

Would trigger GENERATE_ACTIONS parser first (includes() match), fail
to parse JSON, return 500 error before checking GENERATE_ASSET.

Result: Empty assets created, 500 errors in console.

## Root Cause
Signal detection used broad string matching:
- trimmedResponse.includes('GENERATE_ACTIONS')
- trimmedResponse.includes('GENERATE_ASSET')
- trimmedResponse.includes('USE_TOOL:')

This matched signal names ANYWHERE in the response, not just the
actual signal position.

## Fix
Changed to strict regex matching at start of line:
- /^GENERATE_ACTIONS\s*\n---/m - Matches only actual signal format
- /^GENERATE_ASSET\s*\n---/m - Requires newline + separator
- /^USE_TOOL:\s*(\w+)/m - Only at line start

Now only matches proper signal format:
```
GENERATE_ASSET
---
{json}
```

Not casual mentions in explanatory text.

## Testing
Agent can now safely explain signals without triggering parsers.
Only actual signal formats trigger parsing.

**Changed files:**
- netlify/functions/agent-chat.js

---
