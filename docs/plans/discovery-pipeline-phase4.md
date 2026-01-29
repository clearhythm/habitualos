# Discovery Pipeline — Phase 4: Draft Reconciler

> **Note**: This plan was drafted in a planning session and needs refinement — some assumptions about the feedback bug root cause may be incorrect. Verify actual Firestore data and agent chat logs before implementing the bug fix. The tool calling logging infrastructure (see `tool-calling-logging.md`) should be built first to provide visibility into what's happening.

---

## Pre-requisite: Bug Fix — submit_draft_review not capturing feedback data

**Problem**: When the agent reviews drafts via chat, `submit_draft_review` is called but feedback fields (score, feedback, user_tags) are empty in Firestore. The agent LLM isn't properly extracting/including the user's actual feedback when making the tool call.

**Suspected root causes** (needs verification with better logging):
1. No input validation in the tool handler — accepts undefined/empty values without complaint
2. Review prompt isn't explicit enough about requiring real extracted values
3. Agent chats aren't auto-saving after review tasks complete (loss of context)

**Proposed fix (2 changes in `agent-chat.js`):**

### Fix 1: Add validation in the tool handler (line ~327)

```javascript
if (name === 'submit_draft_review') {
  const { draftId, score, feedback, status, user_tags } = input;

  if (!draftId || !draftId.startsWith('draft-')) {
    return { error: 'Invalid draft ID format' };
  }
  // Validate feedback fields have real values
  if (score === undefined || score === null || typeof score !== 'number') {
    return { error: 'Score is required (0-10). Extract from user conversation.' };
  }
  if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
    return { error: 'Feedback summary is required. Summarize what the user said.' };
  }
  if (!status || !['accepted', 'rejected'].includes(status)) {
    return { error: 'Status must be "accepted" or "rejected".' };
  }
  // ... rest of handler
```

### Fix 2: Strengthen the review context prompt (line ~690)

Replace the current extraction instructions with:

```
After the user shares their thoughts on each draft, use the submit_draft_review tool. You MUST include:
- score: A number 0-10 based on the user's expressed interest. Very excited: 8-10. Interested but uncertain: 5-7. Not interested: 1-4.
- feedback: A 1-2 sentence summary capturing the user's actual opinion in their own words. Never leave this empty.
- status: "accepted" if score >= 5, "rejected" if score < 5
- user_tags: Any relevant tags the user mentioned or that describe their sentiment

Do NOT call submit_draft_review until the user has shared their opinion. Wait for their response first.
```

### Fix 3: Auto-save chat after review completion

When all drafts are reviewed and the review action is completed, the chat should auto-save so the conversation (including tool calls) is preserved.

---

## Phase 4: Reconciler

Converts reviewed Firestore drafts into markdown files on the filesystem. ALL reviewed drafts become files — the scoring and annotation IS the data, not a gate. Both positively and negatively evaluated companies are written to build a comprehensive record.

### Status Model Change

**Old:** `pending` → `accepted` / `rejected` → `committed`
**New:** `pending` → `reviewed` → `committed`

The user's sentiment is captured in feedback data (score, narrative, tags), not in the draft status. The status is purely a workflow stage.

**Changes needed:**
- `submit_draft_review` tool in `agent-chat.js`: change from setting status to `accepted`/`rejected` → set to `reviewed`
- `reconcile()`: query drafts with `status: 'reviewed'` (not `accepted`)
- Draft schema comment updates in `db-agent-drafts.cjs`

### Dual-Mode Write Strategy

- **Local mode** (`APP_ENV=local`): Write files directly via `agent-filesystem.cjs`
- **Remote mode** (Netlify production): Commit files via GitHub API using Octokit

Both modes share the same core logic. Mode detected automatically via `APP_ENV`.

### Files to Create

**1. `netlify/functions/_utils/draft-reconciler.cjs`** — Core reconciliation logic

Exports:
- `reconcile({ userId? })` — Main entry. Returns `{ committed, skipped, errors, details }`
- `generateMarkdown(draft, feedback)` — YAML frontmatter string from draft data + feedback
- `toFilename(name)` — "Spring Health" → `Spring-Health.md`

Reconciliation flow:
1. Query all reconcilable drafts via `getReconciledDrafts()` (handles `reviewed` + legacy `accepted`/`rejected`)
2. Optionally filter by `userId` if provided
3. For each draft:
   a. Look up agent via `getAgent(draft.agentId)` → get `localDataPath`
   b. Look up feedback via `getFeedbackByDraft(draft.id, draft._userId)`
   c. Generate markdown (merge draft.data + feedback into YAML frontmatter)
   d. Compute relative path: `companies/{Slug}.md`
   e. Check if file already exists (dedup)
   f. Write file (local fs or GitHub API depending on mode)
   g. Mark draft status as `committed` via `updateDraftStatus()`
4. Return summary

Local mode reuses `agent-filesystem.cjs`. Remote mode uses `github-commit.cjs`.

**2. `netlify/functions/_utils/github-commit.cjs`** — GitHub API utility

Exports:
- `fileExists(repoRelativePath)` — Check via GitHub contents API
- `commitFiles(files, message)` — Atomic commit via Git Data API

Env vars: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`

**3. `netlify/functions/reconciler-run-background.js`** — Netlify background function

- POST with optional `{ userId }` body
- Calls `reconcile()`, logs results
- Returns 202 immediately

### Files to Modify

**`netlify/functions/_services/db-agent-drafts.cjs`** — Add:
```javascript
exports.getDraftsByStatus = async (status) => {
  return await dbCore.query({
    collection: 'agent-drafts',
    where: `status::eq::${status}`
  });
};

exports.getReconciledDrafts = async () => {
  const [reviewed, accepted, rejected] = await Promise.all([
    exports.getDraftsByStatus('reviewed'),
    exports.getDraftsByStatus('accepted'),
    exports.getDraftsByStatus('rejected')
  ]);
  return [...reviewed, ...accepted, ...rejected];
};
```

**`netlify/functions/agent-chat.js`** — Change `submit_draft_review` to set draft status to `reviewed` (not `accepted`/`rejected`)

**`netlify.toml`** — Add schedule: `[functions."reconciler-run-background"]` schedule = "0 7 * * *"

**`package.json`** — Add `@octokit/rest`

**`.env`** — Add `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`

### Markdown Generation

Field mapping:
| Frontmatter field | Source |
|---|---|
| type | Hardcoded: `company` |
| name | `draft.data.name` |
| domain | `draft.data.domain` |
| stage | `draft.data.stage` |
| employee_band | `draft.data.employee_band` |
| agent_recommendation | `draft.data.agent_recommendation` |
| agent_fit_score | `draft.data.agent_fit_score` |
| user_fit_score | `feedback.score` |
| user_feedback | `feedback.feedback` |
| agent_tags | `draft.data.agent_tags` |
| user_tags | `feedback.user_tags` |
| source | Hardcoded: `agent-discovery` |
| discovered_at | `draft._createdAt` → ISO string |

### Implementation Sequence

1. **Build tool calling logging** (see `tool-calling-logging.md`) — needed for debugging
2. **Fix `agent-chat.js`** — Validation + stronger prompt + auto-save + status model change
3. **Update `db-agent-drafts.cjs`** — Add `getDraftsByStatus()`, schema comments
4. **Create `draft-reconciler.cjs`** — Core logic with local mode
5. **Create `reconciler-run-background.js`** — Endpoint, test locally
6. **Create `github-commit.cjs`** — GitHub API, wire into remote mode
7. **Update `netlify.toml`**, `package.json`, `.env`

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Agent not found | Skip draft, log error, do NOT mark committed |
| Agent has no `localDataPath` | Skip draft, log error |
| Draft has no `data.name` | Skip draft, log error |
| Feedback not found | Continue — user fields will be empty |
| Local fs write fails | Skip draft, log error |
| GitHub API fails | Fail entire batch (atomic), log error |
| No reviewed drafts | Return `{ committed: 0 }`, not an error |
| File already exists | Skip write, still mark as committed |

### Key Files Reference

| File | Role |
|------|------|
| `netlify/functions/_services/db-agent-drafts.cjs` | Draft CRUD + new getDraftsByStatus |
| `netlify/functions/_services/db-user-feedback.cjs` | getFeedbackByDraft for user scores |
| `netlify/functions/_services/db-agents.cjs` | getAgent for localDataPath lookup |
| `netlify/functions/_utils/agent-filesystem.cjs` | Local file writes (reused as-is) |
| `netlify/functions/agent-chat.js` | submit_draft_review tool (status + validation) |
| `data/careerlaunch-agent-mk3jq2dqjbfy/_templates/company.md` | YAML frontmatter schema |
