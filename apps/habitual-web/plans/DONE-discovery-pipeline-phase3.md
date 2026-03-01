# Discovery Pipeline — Phase 3: Feedback-Informed Search

**Status**: Ready for implementation (Phase 4 reconciler validated)

---

## Overview

Automated discovery pipeline that searches for companies based on an agent's goal and user feedback history. Creates drafts in Firestore for user review.

**Mental Model**: Agents own their scheduled work. Discovery runs on behalf of a specific agent:
- The agent's goal/instructions guide what to search for
- The agent's feedback history teaches what the user likes
- Drafts are created for that agent
- The review action is assigned to that agent

For now, triggered manually via POST. Scheduling infrastructure comes in [Phase 3b](./discovery-pipeline-phase3b.md).

---

## Architecture Decision: No LangChain.js

Use direct Tavily REST API + existing Anthropic SDK.

**Rationale:**
- Discovery is a linear pipeline (search → extract → score → save), not a complex agent loop
- Tavily REST API is ~5 lines to call; Claude native tool_use provides structured output
- Avoids heavyweight dependencies for minimal benefit

---

## Dependencies

**Tavily search API** — LLM-optimized web search
- Free tier: 1,000 searches/month
- REST API: `https://api.tavily.com/search`
- Env var: `TAVILY_API_KEY`
- No package needed (use fetch)

---

## Files to Create

### 1. `netlify/functions/_utils/discovery-pipeline.cjs`

Core discovery logic. Exports `runDiscovery({ agentId, userId })`.

**Stage 1: Build Search Context**
- Get agent → read goal, instructions
- Query user-feedback for this agent → extract preference patterns
- Query existing drafts (any status) → know what exists for deduplication
- Claude: synthesize 3-5 search queries from goal + preferences

**Stage 2: Search + Extract**
- Call Tavily API for each query (10 results per query)
- Claude: extract structured company data using tool_use
- Deduplicate by company name (case-insensitive)

**Stage 3: Save Results**
- Create 3-5 drafts in Firestore (status: pending)
- Create ONE review action: "Review N new company recommendations"
  - taskType: "review"
  - taskConfig: { draftType: "company" }

### 2. `netlify/functions/discovery-run.js`

HTTP endpoint:
- POST with `{ userId, agentId }`
- Returns `{ draftIds, searchQueries, errors }`

```javascript
const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { userId, agentId } = JSON.parse(event.body);
  if (!userId || !agentId) {
    return { statusCode: 400, body: 'userId and agentId required' };
  }

  const result = await runDiscovery({ agentId, userId });
  return { statusCode: 200, body: JSON.stringify(result) };
};
```

---

## Files to Modify

- **`.env`** — Add `TAVILY_API_KEY`

---

## Company Extraction Tool Schema

```javascript
{
  name: "extract_company",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      domain: { type: "string" },
      stage: { type: "string", enum: ["pre-seed", "seed", "series-a", "series-b", "series-c+", "public", "unknown"] },
      employee_band: { type: "string", enum: ["1-10", "11-50", "51-200", "201-500", "500-1000", "1000+", "unknown"] },
      agent_recommendation: { type: "string" },
      agent_fit_score: { type: "number" },
      agent_tags: { type: "array", items: { type: "string" } }
    },
    required: ["name", "domain", "agent_recommendation", "agent_fit_score"]
  }
}
```

---

## Data Flow

```
[POST /api/discovery-run { agentId, userId }]
     │
     ▼
┌─────────────────────────────────────────────┐
│ Stage 1: Build Context                      │
│ • Get agent goal/instructions               │
│ • Query feedback: what user liked/disliked  │
│ • Query drafts: what companies exist        │
│ • Claude → 3-5 targeted search queries      │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│ Stage 2: Search + Extract                   │
│ • Tavily search (10 results per query)      │
│ • Claude tool_use → structured company data │
│ • Deduplicate by name                       │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│ Stage 3: Save                               │
│ • Create drafts (status: pending)           │
│ • Create review action for user             │
└─────────────────────────────────────────────┘
```

---

## Verification

1. Add `TAVILY_API_KEY` to `.env`
2. Get your userId and agentId (careerlaunch agent)
3. Run:
   ```bash
   curl -X POST http://localhost:8888/api/discovery-run \
     -H "Content-Type: application/json" \
     -d '{"userId":"u-...", "agentId":"agent-..."}'
   ```
4. Check Firestore: new drafts with `status: pending`
5. Check Firestore: new review action created
6. Open agent chat with review action → walk through drafts
7. Run reconciler → verify markdown files created

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No feedback history | Use agent goal only, skip preference learning |
| Tavily rate limit | Log error, continue with other queries |
| Tavily API error | Log error, return partial results |
| No companies extracted | Return empty draftIds, no action created |
| Claude API error | Log error, skip that query |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search strategy | Agent goal + feedback | Personalized, learns over time |
| Search API | Tavily REST (fetch) | No new deps, LLM-optimized |
| Companies per run | 3-5 | Manageable review session |
| Deduplication | By company name | Simple, effective |
| Trigger | Manual POST first | Debuggable, add schedule later |

---

## Key Files Reference

| File | Role |
|------|------|
| `netlify/functions/_services/db-agents.cjs` | getAgent for goal/instructions |
| `netlify/functions/_services/db-user-feedback.cjs` | getFeedbackByAgent for patterns |
| `netlify/functions/_services/db-agent-drafts.cjs` | createDraft, getDraftsByAgent |
| `netlify/functions/_services/db-actions.cjs` | createAction for review action |
