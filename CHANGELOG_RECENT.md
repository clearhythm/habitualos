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
