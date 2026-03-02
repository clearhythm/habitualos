# Phase 1: Article Discovery

## Context

The discovery pipeline currently finds companies. This phase adds a parallel article
pipeline that pulls thought leadership, industry analysis, and company blogs relevant
to the agent's goal. Reviewed articles are saved as full-content markdown files
locally — vector-store-ready for future semantic search and article drafting.

See `plan-job-search-evolution.md` for the broader roadmap this fits into.

## Reference Files

Before building, read these:
- `netlify/functions/_utils/discovery-pipeline.cjs` — the company pipeline to mirror
- `netlify/functions/_utils/draft-reconciler.cjs` — update to handle articles
- `netlify/functions/discovery-scheduled.js` — hook article pipeline here
- `netlify/functions/discovery-run.js` — hook article pipeline here
- `netlify/functions/fox-ea-chat-init.js` — verify article drafts surface for review

---

## 1a. Create `netlify/functions/_utils/article-pipeline.cjs`

Mirror `discovery-pipeline.cjs` structure exactly: same exports shape
(`runArticleDiscovery({ agentId, userId })`), same 3-stage flow, same error handling.

### Stage 1 — Build context

Same as company pipeline: read agent goal + preference profile. Additionally load
existing article URLs from Firestore drafts — deduplication key is `data.url`, not `data.name`.

```javascript
const existingUrls = new Set(
  existingDrafts
    .filter(d => d.type === 'article')
    .map(d => d.data?.url)
    .filter(Boolean)
);
```

### Stage 1b — Generate search queries

Different prompt from company search — target content, not companies:

```
You are helping a user find high-quality articles, essays, and thought leadership
relevant to their career interests.

USER'S AGENT GOAL:
{goal}

Generate 3-5 search queries to find articles the user would find valuable.
Target: industry analysis, thought leadership essays, company engineering/product blogs,
Substack newsletters, trade publications.
Avoid: job listings, company homepages, generic news.

Each query should be 5-15 words. Bias toward depth over recency.

Return ONLY a JSON array of query strings.
```

### Stage 2 — Search + extract

Use Tavily with `include_raw_content: true` to capture full article text:

```javascript
body: JSON.stringify({
  api_key: apiKey,
  query: query,
  max_results: 8,
  include_raw_content: true    // ← key difference from company pipeline
})
```

Use this tool schema for Claude extraction:

```javascript
const EXTRACT_ARTICLE_TOOL = {
  name: 'extract_article',
  description: 'Extract an article from search results. Call for each article worth reading.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      url: { type: 'string' },
      publication: { type: 'string', description: 'Publication name or domain' },
      author: { type: 'string' },
      summary: { type: 'string', description: '2-3 sentence summary of the article' },
      topics: { type: 'array', items: { type: 'string' } },
      content_type: {
        type: 'string',
        enum: ['essay', 'analysis', 'interview', 'report', 'news', 'tutorial']
      },
      relevance_score: { type: 'number', description: '1-10 fit to the user goal' },
      recommendation: { type: 'string', description: 'Why this is worth reading (1-2 sentences)' }
    },
    required: ['title', 'url', 'summary', 'relevance_score', 'recommendation']
  }
};
```

After extraction, pass raw_content through alongside extracted metadata so it can
be stored. Tavily returns `raw_content` per result — match it to the extracted URL.

### Stage 3 — Save as drafts

```javascript
await createDraft({
  _userId: userId,
  agentId: agentId,
  type: 'article',
  status: 'pending',
  data: {
    title,
    url,
    publication,
    author,
    summary,           // short — used for Fox-EA review card
    content,           // raw_content from Tavily, truncated to 10000 chars
    topics,
    content_type,
    relevance_score,
    recommendation
  }
});
```

Limit to 5 articles per run (same as company pipeline).

Create a review action:
```javascript
title: `Review ${draftIds.length} new article${draftIds.length > 1 ? 's' : ''}`,
taskConfig: { draftType: 'article', sourceAgentId: agentId, draftIds }
```

---

## 1b. Update `netlify/functions/_utils/draft-reconciler.cjs`

Add article handling in the `reconcile()` loop alongside the existing company logic.

**File path:** `data/{agentLocalPath}/articles/{slug}.md`
**Slug:** from `draft.data.title` using existing `toFilename()` — no changes needed there.

**`generateArticleMarkdown(draft)` function:**

```javascript
function generateArticleMarkdown(draft) {
  const data = draft.data || {};
  const review = draft.review || null;

  const frontmatter = {
    type: 'article',
    title: data.title || '',
    url: data.url || '',
    publication: data.publication || '',
    author: data.author || '',
    content_type: data.content_type || '',
    topics: data.topics || [],
    relevance_score: data.relevance_score ?? '',
    user_score: review?.score ?? '',
    user_feedback: review?.feedback || '',
    source: 'agent-discovery',
    discovered_at: formatTimestamp(draft._createdAt) || ''
  };

  // ... same YAML serialization as generateMarkdown() ...

  // Append full content as body if available
  const body = data.content ? `\n${data.content}\n` : `\n${data.summary || ''}\n`;

  return yaml + body;
}
```

In `reconcile()`, branch on `draft.type`:
```javascript
const markdown = draft.type === 'article'
  ? generateArticleMarkdown(draft)
  : generateMarkdown(draft);       // existing company logic

const typeFolder = draft.type === 'article' ? 'articles' : pluralize(draft.type);
```

---

## 1c. Hook into discovery functions

**`netlify/functions/discovery-scheduled.js`** — also fix hardcoded IDs here (see cleanup plan):

```javascript
const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');
const { runArticleDiscovery } = require('./_utils/article-pipeline.cjs');

const userId = process.env.DISCOVERY_USER_ID;
const agentId = process.env.DISCOVERY_AGENT_ID;

if (!userId || !agentId) {
  console.warn('[discovery-scheduled] DISCOVERY_USER_ID or DISCOVERY_AGENT_ID not set');
  return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
}

await runDiscovery({ agentId, userId });
await runArticleDiscovery({ agentId, userId });
```

**`netlify/functions/discovery-run.js`** — same addition for manual triggering.

---

## 1d. Verify Fox-EA surfaces article drafts

Read `fox-ea-chat-init.js` and check how it loads pending drafts and review actions.
If the review action detection is `draftType: 'company'`-specific, generalize it to
handle any `draftType`.

The Fox-EA review presentation for an article should show:
- Title + publication
- Summary
- Relevance score + recommendation
- Link to URL

No new UI needed — Fox-EA already handles conversational review. Just confirm it
won't silently skip `type: 'article'` drafts.

---

## 1e. Model update

Update `claude-sonnet-4-5-20250929` → `claude-sonnet-4-6` in:
- `netlify/functions/_utils/discovery-pipeline.cjs`
- `netlify/functions/_utils/article-pipeline.cjs` (new file, use correct model from the start)
- `netlify/functions/_utils/preference-profile-generator.cjs`

---

## File Map

| File | Action | Notes |
|------|--------|-------|
| `_utils/article-pipeline.cjs` | **Create** | New — mirror discovery-pipeline.cjs |
| `_utils/draft-reconciler.cjs` | **Modify** | Add article type + generateArticleMarkdown() |
| `functions/discovery-scheduled.js` | **Modify** | Add article pipeline call + fix env vars |
| `functions/discovery-run.js` | **Modify** | Add article pipeline call |
| `functions/fox-ea-chat-init.js` | **Verify** | Confirm article drafts surface for review |
| `_utils/discovery-pipeline.cjs` | **Modify** | Model update only |
| `_utils/preference-profile-generator.cjs` | **Modify** | Model update only |

---

## Done When

- `discovery-run.js` can be called manually and returns article drafts in Firestore
- Fox-EA shows article review cards and scoring works
- After scoring, `reconciler-run.js` writes article markdown files to
  `data/{agentPath}/articles/` with frontmatter + full content
- Scheduled discovery runs both pipelines without error
