# Discovery Pipeline — Current State & Outstanding Work

## System Overview

An automated company discovery pipeline that searches the web for companies matching a user's career interests, creates drafts in Firestore for review, and lets the user review them conversationally via agent chat.

**Pipeline flow:**
1. Claude generates 3-5 search queries from agent goal + preference profile (or raw feedback)
2. Tavily API searches the web (10 results per query)
3. Claude extracts structured company data via tool_use
4. Drafts saved to Firestore (status: pending)
5. Review action created for the user (with `sourceAgentId` in taskConfig)
6. Fox-EA detects pending drafts and presents them conversationally, one by one
7. User reviews via Fox-EA chat → feedback stored (linked to source agent) → drafts marked reviewed
8. Preference profile regenerated after review session completes
9. Reconciler converts reviewed drafts to markdown files

## What's Running Now

- **Scheduled discovery**: `discovery-scheduled.js` runs weekdays at 5am PT (1pm UTC)
  - Hardcoded to user `u-mgpqwa49` and agent `agent-mk3jq2dqjbfy`
  - Uses Tavily free tier (1,000 searches/month, ~5 per run = ~100/month on weekdays)
- **Manual trigger**: `discovery-run-background.js` at `/.netlify/functions/discovery-run-background`
  - Background function (returns 202, runs up to 15min)
  - POST with `{"userId":"u-mgpqwa49","agentId":"agent-mk3jq2dqjbfy"}`
- **Sync endpoint**: `discovery-run.js` at `/api/discovery-run` — has 60s timeout but still hits Netlify's 26s gateway limit. Use the background version instead.
- **Chat review**: Fox-EA detects pending drafts at init, presents them conversationally with `submit_draft_review` tool. Feedback stored with source agent's ID for the discovery feedback loop.
- **Preference profile**: Generated after review sessions via `preference-profile-generator.cjs`. Discovery pipeline reads the profile to shape future search queries.
- **Reconciler**: `reconciler-run.js` at `/api/reconciler-run` — converts reviewed drafts to markdown files (local mode only)

## Key Files

| File | Purpose |
|------|---------|
| `netlify/functions/discovery-scheduled.js` | Cron-triggered scheduled function |
| `netlify/functions/discovery-run-background.js` | Manual trigger (background) |
| `netlify/functions/discovery-run.js` | Manual trigger (sync, limited by gateway timeout) |
| `netlify/functions/_utils/discovery-pipeline.cjs` | Core pipeline: search queries → Tavily → Claude extraction → save drafts |
| `netlify/functions/_services/db-agent-drafts.cjs` | Drafts CRUD (collection: `agent-drafts`) |
| `netlify/functions/_services/db-user-feedback.cjs` | Feedback CRUD (collection: `user-feedback`) |
| `netlify/functions/_utils/draft-reconciler.cjs` | Converts reviewed drafts → markdown files |
| `netlify/functions/reconciler-run.js` | HTTP endpoint for reconciler |
| `netlify/functions/fox-ea-chat-init.js` | Fox-EA init — surfaces pending drafts + review tools |
| `netlify/functions/fox-ea-tool-execute.js` | Fox-EA tool handler — review tools + project tools |
| `netlify/functions/_services/db-preference-profile.cjs` | Preference profile CRUD (collection: `preference-profiles`) |
| `netlify/functions/_utils/preference-profile-generator.cjs` | Claude-powered preference profile generation from feedback |
| `netlify/functions/agent-chat.js` | Agent chat endpoint (still has review tools for legacy use) |

## Environment Variables

| Var | Where | Notes |
|-----|-------|-------|
| `TAVILY_API_KEY` | .env + Netlify (habitual-web) | Free tier: 1,000 searches/month |
| `ANTHROPIC_API_KEY` | .env + Netlify | Used by discovery pipeline for query generation + extraction |

## Outstanding Work

### High Priority

**1. Deduplication improvements**
The pipeline deduplicates by company name against existing drafts, but over time the same companies will keep appearing in search results. Consider:
- Checking against committed/reviewed drafts too (currently does this)
- More aggressive dedup (by domain, not just name)
- Skip companies the user has already rejected (low score in feedback)

**2. Remove hardcoded user/agent from scheduled function**
Currently `discovery-scheduled.js` has hardcoded IDs. To support multiple users or agents:
- Add a `discoveryEnabled: true` flag to agents
- Query for agents with discovery enabled
- Run pipeline for each

**3. Review the agent's goal/instructions**
The careerlaunch agent's goal drives the search queries. It was set up during initial development and may need updating to reflect current career interests. Check the agent in Firestore and update via the app.

### Medium Priority

**4. Expand content types beyond companies**
The pipeline currently only finds companies. The `agent-drafts` collection supports a `type` field (company | person | article | job). Future content types:
- Job postings / roles at interesting companies
- People to connect with
- Industry signals (funding, launches, acquisitions)
- Each would need its own extraction tool schema in `discovery-pipeline.cjs`

**5. GitHub integration for reconciler**
The reconciler (`draft-reconciler.cjs`) only writes markdown files locally. On Netlify (production), the filesystem is read-only. Plan exists at `docs/plans/discovery-pipeline-github.md` — uses Octokit to commit files via GitHub API. Not critical unless you want reconciled markdown files in the repo from production runs.

**6. Scheduled executor generalization (phase 3b)**
The original plan (`docs/plans/discovery-pipeline-phase3b.md`) envisioned a general scheduled action executor that could run any type of scheduled work (discovery, digests, reports). Currently we have a purpose-built `discovery-scheduled.js` instead. Generalize if/when more scheduled task types are needed.

### Low Priority

**7. Frontend discovery management**
No UI exists to:
- View discovery history / past runs
- Enable/disable discovery per agent
- Configure search frequency
- See pipeline errors

**8. Search quality tuning**
- Tavily `max_results` is 10 per query — could adjust
- Companies per run capped at 5 — could adjust
- Claude model for extraction is `claude-sonnet-4-5-20250929` — could use newer models
- Search queries could be more targeted with better prompting

**9. Background function cleanup**
`discovery-run-background.js` was created for testing. Could be removed if not needed long-term, or kept as a manual trigger option. The sync `discovery-run.js` is mostly useless in production due to the gateway timeout.

## Previous Plan Documents

| File | Status | Notes |
|------|--------|-------|
| `DONE-discovery-pipeline-phase1.md` | Complete | Company schema |
| `DONE-discovery-pipeline-phase2.md` | Complete | Firestore drafts + feedback services |
| `DONE-discovery-pipeline-phase3.md` | Complete | Search pipeline (Tavily + Claude) |
| `DONE-discovery-pipeline-phase4.md` | Complete | Draft reconciler (local mode) |
| `DONE-discovery-pipeline-phase5.md` | Complete | Chat-based draft review |
| `discovery-pipeline-phase3b.md` | Deferred | General scheduled executor |
| `discovery-pipeline-github.md` | Not started | GitHub API for production reconciler |
| `discovery-pipeline-bugs.md` | Reference | Known bugs and fixes |
| `ARCHIVED-discovery-pipeline-phase3-4.md` | Archived | Superseded plan |

## Draft Status Model

```
pending → reviewed → committed
```

- `pending`: Created by discovery pipeline, awaiting user review
- `reviewed`: User reviewed via chat (has feedback record in `user-feedback`)
- `committed`: Reconciler converted to markdown file
- Legacy statuses `accepted`/`rejected` still exist in old data; reconciler handles them
