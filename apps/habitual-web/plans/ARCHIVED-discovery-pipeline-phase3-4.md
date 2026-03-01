# Discovery Pipeline — Phases 3 & 4 (Deferred)

These phases are deferred until Phases 1, 2, and 5 are working. Implement them after the review flow is validated end-to-end.

---

## Phase 3: Company Discovery Pipeline (LangChain.js)

### Context

HabitualOS is a personal agentic system built on Netlify serverless functions (Node.js, CommonJS), 11ty, and Google Firestore. Phases 1, 2, and 5 added: enhanced company markdown schema, `agent-drafts` and `user-feedback` Firestore collections with services/endpoints, and chat-based draft review via agent tools.

This phase adds an automated discovery pipeline using LangChain.js that searches for companies matching user interests and creates drafts in Firestore.

### New Dependencies

```bash
npm install langchain @langchain/anthropic @langchain/community
```

New env var: `TAVILY_API_KEY` — for web search via Tavily (LLM-optimized search API, free tier: 1000 searches/mo).

### New Files to Create

**`netlify/functions/_chains/discovery-chain.cjs`**

New `_chains/` directory convention (parallel to `_services/` and `_utils/`). Each chain is a self-contained module that uses LangChain.js internally and exports clean functions.

Discovery chain has 3 stages:

**Stage 1: Build Search Context**
- Read user's feedback history from `user-feedback` collection (what they liked/disliked, narrative feedback)
- Read existing company files from the data directory (to avoid duplicates)
- Construct a user interest profile text from feedback patterns

**Stage 2: Search + Extract**
- Use LangChain.js Tavily tool to search for companies
- Use structured output parser (Zod schema) to extract company data matching the draft `data` schema:
  ```
  { name, domain, stage, employee_band, agent_recommendation, agent_fit_score, agent_tags, links }
  ```
- Deduplicate against existing drafts and committed company files

**Stage 3: Score + Propose**
- Score each company against user preferences via LLM
- Generate `agent_recommendation` and `agent_fit_score`
- Write drafts to Firestore via `db-agent-drafts.cjs`
- Create ONE review Action for user: "Review latest company recommendations"

Export: `async function runDiscovery({ agentId, userId, preferences, existingCompanies })` → returns array of created draft IDs.

**`netlify/functions/discovery-run-background.js`**

Netlify background function (can run up to 15 min). Naming convention: `*-background.js`.

- Accepts POST with `{ userId, agentId }`
- Loads user preferences (feedback history + existing companies)
- Calls `runDiscovery()` from discovery-chain.cjs
- Returns summary of what was created

### LangChain.js Scope

- Used ONLY for the discovery pipeline — does NOT replace existing Anthropic SDK usage in `agent-chat.js`
- Contained in `_chains/` directory
- Rest of system calls clean functions, never sees LangChain internals
- Model-agnostic: can swap Claude for GPT-4 or other models later

### Scheduling

Add to `netlify.toml`:
```toml
[functions."discovery-run-background"]
  schedule = "0 6 * * *"    # Daily at 6am UTC
```

Also triggerable manually via POST for testing.

### Files to Modify
- `package.json` — Add langchain deps
- `netlify.toml` — Add schedule config
- `.env` — Add `TAVILY_API_KEY`

### Verification
```bash
# Trigger discovery manually
curl -X POST localhost:8888/api/discovery-run-background \
  -d '{"userId":"USER_ID","agentId":"AGENT_ID"}'
```
- Verify drafts appear in Firestore with structured company data
- Verify ONE review Action created for user
- Run again → no duplicate drafts

---

## Phase 4: GitHub Reconciler

### Context

This phase adds a background function that commits accepted drafts as markdown files to the git repository via the GitHub API. This completes the loop: agent discovers → user reviews → accepted content becomes durable markdown in git → Netlify auto-deploys.

### New Dependency

```bash
npm install @octokit/rest
```

New env vars: `GITHUB_TOKEN` (Personal Access Token with `repo` scope), `GITHUB_OWNER`, `GITHUB_REPO`

### New Files to Create

**`netlify/functions/_utils/github-commit.cjs`**

Core utility for GitHub file operations:
- Initialize Octokit with `GITHUB_TOKEN`
- `getFileIfExists(path)` — check if file exists in repo, return content or null
- `commitFiles(files, message)` — commit multiple files in a single commit via GitHub API
  - Get current commit SHA for main branch
  - Get tree SHA
  - Create blobs for each file
  - Create new tree with file blobs
  - Create commit pointing to new tree
  - Update main branch ref to new commit

**`netlify/functions/reconciler-run-background.js`**

Background function that:
1. Queries Firestore for drafts with `status: "accepted"` via `db-agent-drafts.cjs`
2. For each draft, generates markdown content:
   - Frontmatter from draft `data` fields + any user feedback (user_fit_score, user_feedback, user_tags from `user-feedback` collection)
   - No body sections (frontmatter only)
3. File path: `data/{agentLocalDataPath}/companies/{Slug}.md`
   - Slug: company name → PascalKebab: "Spring Health" → `Spring-Health.md`
4. Checks if file already exists via `getFileIfExists()` to deduplicate
5. Commits all new files in a single commit: `"Add {N} company file(s) from discovery"`
6. Marks processed drafts as `status: "committed"` in Firestore

### Strategy
Direct commit to main branch (no PRs). This is a personal tool. PR workflow can be added later if desired.

### Scheduling
```toml
[functions."reconciler-run-background"]
  schedule = "0 7 * * *"    # Daily at 7am UTC (1 hour after discovery)
```

### Files to Modify
- `package.json` — Add @octokit/rest
- `netlify.toml` — Add schedule config
- `.env` — Add `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`

### Verification
1. Accept a draft (set status to "accepted" via API or through chat review)
2. Trigger reconciler: `curl -X POST localhost:8888/api/reconciler-run-background -d '{"userId":"USER_ID","agentId":"AGENT_ID"}'`
3. Verify markdown file committed to GitHub repo (check git log or GitHub UI)
4. Verify draft status changed to "committed" in Firestore
5. Verify Netlify deploys automatically and file is readable at the deployed site
