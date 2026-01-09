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
