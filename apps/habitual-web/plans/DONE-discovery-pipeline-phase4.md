# Discovery Pipeline — Phase 4: Draft Reconciler

Converts reviewed Firestore drafts into markdown files on the local filesystem. ALL reviewed drafts become files — the scoring and annotation IS the data, not a gate. Both positively and negatively evaluated companies are written to build a comprehensive record.

> **Note**: This phase covers local mode only. See [discovery-pipeline-github.md](./discovery-pipeline-github.md) for the GitHub API integration needed for production/mobile usage.

---

## Pre-requisite: Bug Fix — submit_draft_review not capturing feedback data

**Problem**: When the agent reviews drafts via chat, `submit_draft_review` is called but feedback fields (score, feedback, user_tags) are empty in Firestore. The LLM isn't properly extracting/including the user's actual feedback when making the tool call.

**Root causes**:
1. No input validation in the tool handler — accepts undefined/empty values without complaint
2. Review prompt isn't explicit enough about requiring real extracted values
3. Agent chats aren't auto-saving after review tasks complete (loss of context)

### Fix 1: Add validation in the tool handler

File: `netlify/functions/agent-chat.js` (around line 328)

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
  // Note: status is now ignored - we always set to 'reviewed'
  // ... rest of handler
```

### Fix 2: Strengthen the review context prompt

Update the review context prompt to be more explicit about extraction requirements:

```
After the user shares their thoughts on each draft, use the submit_draft_review tool. You MUST include:
- score: A number 0-10 based on the user's expressed interest. Very excited: 8-10. Interested but uncertain: 5-7. Not interested: 1-4.
- feedback: A 1-2 sentence summary capturing the user's actual opinion in their own words. Never leave this empty.
- user_tags: Any relevant tags the user mentioned or that describe their sentiment

Do NOT call submit_draft_review until the user has shared their opinion. Wait for their response first.
```

### Fix 3: Auto-save chat after review completion

When all drafts are reviewed and the review action is completed, the chat should auto-save so the conversation (including tool calls) is preserved.

---

## Status Model Change

**Old:** `pending` → `accepted` / `rejected` → `committed`
**New:** `pending` → `reviewed` → `committed`

The user's sentiment is captured in feedback data (score, narrative, tags), not in the draft status. The status is purely a workflow stage.

**Changes needed:**
- `submit_draft_review` tool in `agent-chat.js`: always set status to `reviewed` (ignore the `status` param from LLM)
- `reconcile()`: query drafts with `status: 'reviewed'` (plus legacy `accepted`/`rejected` for backcompat)
- Draft schema comment updates in `db-agent-drafts.cjs`

---

## Reconciler Implementation

### Files to Create

**`netlify/functions/_utils/draft-reconciler.cjs`** — Core reconciliation logic

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
   f. Write file via `agent-filesystem.cjs`
   g. Mark draft status as `committed` via `updateDraftStatus()`
4. Return summary

**`netlify/functions/reconciler-run.js`** — HTTP endpoint for triggering reconciliation

- POST with optional `{ userId }` body
- Calls `reconcile()`, returns results
- Can be called manually or via scheduled trigger

### Files to Modify

**`netlify/functions/_services/db-agent-drafts.cjs`** — Add query methods:

```javascript
/**
 * Get all drafts with a specific status
 * @param {string} status - Status to filter by
 * @returns {Promise<Array>} Array of drafts
 */
exports.getDraftsByStatus = async (status) => {
  return await dbCore.query({
    collection: 'agent-drafts',
    where: `status::eq::${status}`
  });
};

/**
 * Get all drafts ready for reconciliation
 * Includes 'reviewed' status + legacy 'accepted'/'rejected' for backcompat
 * @returns {Promise<Array>} Array of drafts
 */
exports.getReconciledDrafts = async () => {
  const [reviewed, accepted, rejected] = await Promise.all([
    exports.getDraftsByStatus('reviewed'),
    exports.getDraftsByStatus('accepted'),
    exports.getDraftsByStatus('rejected')
  ]);
  return [...reviewed, ...accepted, ...rejected];
};
```

Also update schema comments to document the new `reviewed` status.

**`netlify/functions/agent-chat.js`** — Change `submit_draft_review` to always set status to `reviewed`:

```javascript
// Line ~358: Change from
await updateDraftStatus(draftId, status);
// to
await updateDraftStatus(draftId, 'reviewed');
```

---

## Markdown Generation

Field mapping from draft + feedback to YAML frontmatter:

| Frontmatter field | Source |
|---|---|
| type | Hardcoded: `company` (or `draft.type`) |
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

---

## Implementation Sequence

1. **Fix `agent-chat.js`** — Add validation + stronger prompt + status model change
2. **Update `db-agent-drafts.cjs`** — Add `getDraftsByStatus()`, `getReconciledDrafts()`, update schema comments
3. **Create `draft-reconciler.cjs`** — Core logic with local mode
4. **Create `reconciler-run.js`** — HTTP endpoint for triggering

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Agent not found | Skip draft, log error, do NOT mark committed |
| Agent has no `localDataPath` | Skip draft, log error |
| Draft has no `data.name` | Skip draft, log error |
| Feedback not found | Continue — user fields will be empty in output |
| Local fs write fails | Skip draft, log error |
| No reviewed drafts | Return `{ committed: 0 }`, not an error |
| File already exists | Skip write, still mark as committed |

---

## Key Files Reference

| File | Role |
|------|------|
| `netlify/functions/_services/db-agent-drafts.cjs` | Draft CRUD + new getDraftsByStatus |
| `netlify/functions/_services/db-user-feedback.cjs` | getFeedbackByDraft for user scores |
| `netlify/functions/_services/db-agents.cjs` | getAgent for localDataPath lookup |
| `netlify/functions/_utils/agent-filesystem.cjs` | Local file writes (reused as-is) |
| `netlify/functions/agent-chat.js` | submit_draft_review tool (status + validation) |
| `data/careerlaunch-agent-mk3jq2dqjbfy/_templates/company.md` | YAML frontmatter schema reference |
