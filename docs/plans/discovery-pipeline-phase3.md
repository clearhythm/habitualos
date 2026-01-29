# Discovery Pipeline — Phase 3: Company Discovery

**Status**: Deferred until Phase 4 (Reconciler) is validated.

---

## Overview

Automated discovery pipeline that searches for companies matching user interests and creates drafts in Firestore. Runs as a Netlify background function on a daily schedule.

## Architecture Decision: No LangChain.js

Use direct Tavily REST API + existing Anthropic SDK.

**Rationale:**
- Discovery is a linear pipeline (search → extract → score → save), not a complex agent loop requiring orchestration
- Project uses CommonJS; LangChain.js has moved toward ESM, causing bundling friction with Netlify's esbuild
- LangChain would be used in one place while the rest of the system uses the Anthropic SDK directly
- Tavily REST API is ~5 lines to call; Claude native tool_use already provides structured JSON output
- Avoids 3 heavyweight dependencies (`langchain`, `@langchain/anthropic`, `@langchain/community`) for minimal benefit

If multi-agent orchestration framework is needed later, evaluate LangChain (or alternatives like Vercel AI SDK) when requirements are clearer.

## System Context

HabitualOS is a personal agentic system built on:
- **Backend**: Netlify serverless functions (Node.js, CommonJS)
- **Database**: Google Firestore
- **AI**: Claude API via Anthropic SDK (`@anthropic-ai/sdk`)
- **Static site**: 11ty with Nunjucks templates
- **Deployment**: Netlify (git-based, read-only filesystem at runtime)

### Existing Infrastructure (from Phases 1, 2, 4, 5)

**Collections:**
- `agent-drafts` — Content drafts for review. Schema: `{ id, _userId, agentId, type, status, data, _createdAt }`
  - Status flow: `pending` → `reviewed` → `committed`
  - Service: `netlify/functions/_services/db-agent-drafts.cjs`
- `user-feedback` — User review feedback. Schema: `{ id, _userId, agentId, draftId, type, score, feedback, user_tags, _createdAt }`
  - Service: `netlify/functions/_services/db-user-feedback.cjs`

**Draft data schema (company type):**
```javascript
{
  name: "Spring Health",
  domain: "springhealth.com",
  stage: "series-b",           // pre-seed | seed | series-a | series-b | series-c+ | public | unknown
  employee_band: "201-500",    // 1-10 | 11-50 | 51-200 | 201-500 | 500-1000 | 1000+
  agent_recommendation: "...", // Agent's reasoning
  agent_fit_score: 8,          // 1-10
  agent_tags: ["healthtech"],
  links: {}                    // Optional URLs
}
```

**Review flow (Phase 5):** Chat-based review via agent tools (`get_pending_drafts`, `submit_draft_review`). Agent presents drafts conversationally, extracts user sentiment, records feedback.

**Reconciler (Phase 4):** Converts all reviewed drafts to markdown files. Both positively and negatively reviewed companies become files — the scoring IS the data, not a gate.

**Company markdown format (YAML frontmatter only):**
```yaml
---
type: company
name: "Spring Health"
domain: springhealth.com
stage: series-b
employee_band: 201-500
agent_recommendation: "..."
agent_fit_score: 8
user_fit_score: 7
user_feedback: "Love the coaching angle"
agent_tags: ["healthtech", "ai"]
user_tags: ["interesting"]
source: agent-discovery
discovered_at: 2026-01-26T06:00:00.000Z
---
```

**Agent schema:** Agents have `localDataPath` (e.g., `careerlaunch-agent-mk3jq2dqjbfy`). Company files live at `data/{localDataPath}/companies/{Name}.md`.

## New Dependency

Tavily search API — LLM-optimized web search.
- Free tier: 1,000 searches/month
- REST API: `https://api.tavily.com/search`
- Env var: `TAVILY_API_KEY`

```bash
npm install @tavily/core
```

Or use direct fetch (no package needed):
```javascript
const response = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
    query: searchQuery,
    max_results: 10,
    include_raw_content: false
  })
});
```

## Files to Create

### 1. `netlify/functions/_utils/discovery-pipeline.cjs`

Core discovery logic. Three stages, all in one module.

**Export:**
```javascript
async function runDiscovery({ agentId, userId }) → { draftIds: string[], searchQueries: string[], errors: string[] }
```

**Stage 1: Build Search Context**
- Read feedback history via `getFeedbackByAgent(agentId, userId)` — what user liked/disliked, patterns
- Read existing company files from filesystem (local) or Firestore drafts (to avoid duplicates)
- Use Claude to synthesize a user interest profile from feedback patterns
- Generate 3-5 targeted search queries based on the profile

**Stage 2: Search + Extract**
- Call Tavily REST API for each search query
- Collect search results (URLs, titles, snippets)
- Call Claude with tool_use to extract structured company data from search results
- Tool schema matches draft `data` fields: `{ name, domain, stage, employee_band, agent_recommendation, agent_fit_score, agent_tags }`
- Deduplicate against existing drafts (by company name) and committed company files

**Stage 3: Save Drafts**
- Write each new company as a draft to Firestore via `createDraft()`
- Status: `pending` (awaiting user review)
- Create ONE review Action for user: "Review latest company recommendations"
  - taskType: "review"
  - taskConfig: { draftType: "company" }
  - Create via `db-actions.cjs.createAction()`

### 2. `netlify/functions/discovery-run-background.js`

Netlify background function. Naming convention: `*-background.js` (runs up to 15 min).

```javascript
require('dotenv').config();
const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');

exports.handler = async (event) => {
  // Background functions return 202 immediately
  const body = JSON.parse(event.body || '{}');
  const { userId, agentId } = body;

  // Validation...

  const result = await runDiscovery({ agentId, userId });
  console.log('[discovery]', JSON.stringify(result));

  return { statusCode: 202, body: JSON.stringify(result) };
};
```

## Files to Modify

- **`package.json`** — Add `@tavily/core` (or skip if using direct fetch)
- **`netlify.toml`** — Add schedule:
  ```toml
  [functions."discovery-run-background"]
    schedule = "0 6 * * *"
  ```
- **`.env`** — Add `TAVILY_API_KEY`

## Scheduling

Daily at 6am UTC (1 hour before reconciler at 7am UTC). Also triggerable manually via POST.

```bash
curl -X POST localhost:8888/api/discovery-run-background \
  -H 'Content-Type: application/json' \
  -d '{"userId":"USER_ID","agentId":"AGENT_ID"}'
```

## Deduplication Strategy

Before creating a draft, check:
1. Existing drafts in Firestore (any status) with same company name for this agent
2. Existing committed company files (query drafts with status "committed", or check filesystem)

Use company name normalization (lowercase, trim) for matching.

## Verification

1. Trigger discovery manually via POST
2. Verify drafts appear in Firestore with structured company data
3. Verify ONE review Action created for user
4. Trigger review flow — agent presents new companies in chat
5. Run discovery again → no duplicate drafts created
6. Run reconciler → reviewed companies become markdown files

## Open Questions for Implementation

- How many companies should one discovery run produce? (Suggest: 3-5 per run)
- Should search queries be randomized or systematic? (Suggest: rotate through different angles — industry, stage, tech stack)
- Should the agent consider geographic preferences?
- How to handle rate limits on Tavily free tier (1000/month ≈ 33/day)?
