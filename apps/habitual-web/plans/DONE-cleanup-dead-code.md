# Cleanup: Dead Code, Legacy Pages, Hardcoded Values

## Context

habitual-web has accumulated one-time data migrations, a legacy backup page, and a discovery
pipeline with hardcoded production IDs — all of which clutter the codebase and create confusing
or broken behavior. This plan removes or fixes each category cleanly.

---

## Phase 1: Delete One-Time Migration Functions

These five functions were run once to fix data issues. They expose live POST endpoints in
production with no auth protection beyond userId, and they're done. Delete them.

**Files to delete:**
- `netlify/functions/data-fix-backfill-action-draftids.js`
- `netlify/functions/data-fix-debug-actions.js`
- `netlify/functions/data-fix-migrate-feedback-to-drafts.js`
- `netlify/functions/data-fix-seed-profiles.js`
- `netlify/functions/migrate-collections.js`

No code elsewhere imports or calls these. Safe to delete outright.

---

## Phase 2: Delete Legacy Dashboard Page

`src/do/backup.njk` is explicitly titled "Dashboard (Legacy)" and is not linked from
navigation. It's a dead template.

**Files to delete:**
- `src/do/backup.njk`

---

## Phase 3: Fix Discovery Pipeline Hardcoded IDs

`netlify/functions/discovery-scheduled.js` hardcodes a single user ID and agent ID:

```javascript
const userId = 'u-mgpqwa49';          // hardcoded
const agentId = 'agent-mk3jq2dqjbfy'; // hardcoded
```

This means the scheduled discovery pipeline only ever runs for one account. Fix by
moving these to environment variables.

**Changes:**
- In `discovery-scheduled.js`: replace hardcoded `userId` and `agentId` with
  `process.env.DISCOVERY_USER_ID` and `process.env.DISCOVERY_AGENT_ID`
- Add both vars to Netlify environment config (already have the values)
- Add validation: if vars are missing, log a warning and return early rather than
  running against undefined values

---

## Phase 4: Keep reconciler-run.js — local-only is intentional

`netlify/functions/reconciler-run.js` writes reviewed Firestore drafts as markdown
files to the local filesystem. This only works in local dev, and that's fine —
it's the intended workflow:

1. Review companies (and soon articles) via Fox-EA in the app
2. Run reconciler locally to sync reviewed drafts to `data/{agentPath}/`
3. Commit the files to the repo intentionally

This local corpus is the foundation for the article drafting + vector store work
described in `plan-job-search-evolution.md`. The files need to live on disk for
VSCode browsing, git history, and future vector store ingestion.

**The `discovery-pipeline-github.md` plan is superseded.** Committing files via
GitHub API would trigger Netlify redeploys and pollute git history with automated
data — not the right tradeoff. Manual reconcile → intentional commit is cleaner.

**No action needed.** Keep both `reconciler-run.js` and `_utils/draft-reconciler.cjs`.

When article discovery is added (see `plan-job-search-evolution.md` Phase 1),
update `draft-reconciler.cjs` to handle `type: 'article'` drafts and save full
content to `data/{agentPath}/articles/`.

---

## Phase 5: Clean Up Plans Directory

The plans directory has 9 completed/archived plans mixed in with active ones,
making it hard to see what's current.

**Files to delete (already completed):**
- `plans/DONE-discovery-pipeline-phase1.md`
- `plans/DONE-discovery-pipeline-phase2.md`
- `plans/DONE-discovery-pipeline-phase3.md`
- `plans/DONE-discovery-pipeline-phase4.md`
- `plans/DONE-discovery-pipeline-phase5.md`
- `plans/DONE-executive-assistant-phase1.md`
- `plans/DONE-executive-assistant-phase2.md`
- `plans/DONE-executive-assistant-phase3.md`
- `plans/DONE-project-goals-actions-phase1.md`
- `plans/DONE-project-goals-actions-phase2.md`
- `plans/DONE-project-goals-actions-phase3.md`
- `plans/DONE-project-goals-actions-phase4.md`
- `plans/ARCHIVED-discovery-pipeline-phase3-4.md`

**Active plans to keep:**
- `discovery-pipeline-bugs.md`
- `discovery-pipeline-github.md`
- `discovery-pipeline-phase3b.md`
- `discovery-pipeline-todos.md`
- `executive-assistant-phase4.md`
- `executive-assistant-phase5.md`
- `implement-action-cards-unification.md`
- `implement-recurring-actions.md`
- `plan-agent-notes.md`
- `project-goals-visualization.md`
- `cleanup-dead-code.md` (this file)

---

## Practice System: No Action Needed

Confirmed: habitual-web has no practice system code. The "Practice ↗" nav link uses
`data-obi-wai-link` which routes to the obi-wai-web app. This is intentional design.
Nothing to clean up here.

---

## Summary

| Action | Count |
|--------|-------|
| Delete migration functions | 5 files |
| Delete legacy page | 1 file |
| Fix env vars in discovery-scheduled.js | 1 file |
| Keep reconciler (local-only is intentional) | no change |
| Delete DONE/ARCHIVED plans | 13 files |
| **Total deletions** | **19 files** |

Low risk — all deletions are confirmed dead code or completed work. The env var fix is
the only behavior change (and it's a fix, not a feature).
