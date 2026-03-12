# Signal — Phase 4: Dynamic RAG via Tool Calls

## Before Starting

**Read these files first** (in order — each informs the next change):

1. `netlify/functions/_services/db-signal-context.cjs` — understand existing function shape before adding `searchChunks`; all new functions follow the same pattern (Firestore query → map docs → return array)
2. `netlify/functions/signal-tool-execute.js` — the stub being replaced; note the existing handler structure
3. `netlify/functions/signal-chat-init.js` — identify the `getTopChunks` import + `buildEvidenceSection` call to remove; understand what the `tools: []` response field currently looks like
4. `netlify/edge-functions/_lib/chat-stream-core.ts` — find the tool body building block by searching for `toolBody.agentId = agentId`; the `signalId` line goes immediately after it

**Prerequisites:** Phase 3 complete — `signal-context-synthesize` must have run at least once so that `skillsProfile`, `wantsProfile`, `personalityProfile` exist on owner docs. The `signal-context-chunks` collection must be populated.

**Key pattern:** All Netlify functions use CommonJS (`require`/`module.exports`). The edge function is Deno/TypeScript. Do not mix module systems.

---

## Context

Phase 3 loads the top 15 evidence chunks unconditionally at conversation init — every visitor gets the same slice regardless of what they actually need. A recruiter hiring for streaming infrastructure and a founder looking for a behavioral health advisor should pull from different parts of the graph. Phase 4 replaces this static dump with a `search_work_history` tool that Claude calls mid-conversation, fetching only the evidence relevant to what the visitor has actually said. This makes context usage proportional to need, scores more grounded in specific matching evidence, and keeps the base system prompt lean enough to cache cheaply.

---

## Architecture

Claude is given a `search_work_history` tool at init. The system prompt stays lean — just synthesized profiles (~200 tokens), no raw chunks. When Claude needs evidence to score a dimension (e.g., the visitor mentions "real-time data pipelines"), it calls the tool with a targeted query string. The edge function routes that call to `signal-tool-execute.js`, which searches the chunk collection by concept overlap, ranks results by score × evidenceStrength, and returns the top 5 formatted as evidence. Claude incorporates those results into its next response and scoring.

```
visitor message
  → edge fn (chat-stream-core.ts)
    → Claude (with search_work_history tool available)
      → tool_use block: { name: "search_work_history", input: { query: "streaming SSE real-time" } }
    → edge fn routes to /api/signal-tool-execute
      → searchChunks(signalId, queryTerms, 5)
        → fetch all processed chunks for signalId
        → score each by concept overlap + title match
        → rank by (matchScore × evidenceStrength)
        → return top 5
    → tool_result injected into conversation
  → Claude continues response with grounded evidence
```

---

## Part 1 — Concept Search

### `db-signal-context.cjs` — add `searchChunks`

```javascript
/**
 * Search processed chunks by concept/keyword overlap.
 * Fetches all processed chunks for signalId, scores by term match,
 * ranks by (matchScore × evidenceStrength), returns top N.
 */
async function searchChunks(signalId, queryTerms, limit = 5) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .where('status', '==', 'processed')
    .get();

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Score: how many query terms appear in the chunk's searchable fields
  const scored = docs.map(doc => {
    const haystack = [
      ...(doc.concepts || []),
      ...(doc.topics || []),
      ...(doc.skills || []),
      ...(doc.technologies || []),
      doc.title || '',
      doc.summary || '',
      doc.keyInsight || ''
    ].join(' ').toLowerCase();

    const matchScore = queryTerms.reduce((n, term) =>
      n + (haystack.includes(term.toLowerCase()) ? 1 : 0), 0
    );

    return { ...doc, matchScore };
  });

  // Filter to at least 1 match, rank by matchScore × evidenceStrength desc
  return scored
    .filter(d => d.matchScore > 0)
    .sort((a, b) => (b.matchScore * b.evidenceStrength) - (a.matchScore * a.evidenceStrength))
    .slice(0, limit);
}
```

Export alongside existing functions.

---

## Part 2 — Tool Execute Endpoint

### `signal-tool-execute.js` — implement `search_work_history`

```javascript
require('dotenv').config();
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { searchChunks } = require('./_services/db-signal-context.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') { ... }

  const { signalId, toolUse } = JSON.parse(event.body);
  const { name, input } = toolUse;

  if (name === 'search_work_history') {
    const rawQuery = String(input.query || '').slice(0, 200);
    // Tokenize: split on whitespace + punctuation, filter short/common words
    const STOPWORDS = new Set(['the','a','an','and','or','for','to','in','of','on','is','are','was','were','with','that','this']);
    const terms = rawQuery
      .toLowerCase()
      .split(/[\s,;:]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t));

    if (!signalId || !terms.length) {
      return { statusCode: 200, body: JSON.stringify({ result: { chunks: [], message: 'No results' } }) };
    }

    const chunks = await searchChunks(signalId, terms, 5);

    const result = {
      query: rawQuery,
      found: chunks.length,
      chunks: chunks.map(c => ({
        date: String(c.date || '').slice(0, 10),
        title: c.title,
        summary: c.summary,
        keyInsight: c.keyInsight,
        evidenceStrength: c.evidenceStrength,
        skills: c.skills?.slice(0, 8) || [],
        topics: c.topics?.slice(0, 5) || []
      }))
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    };
  }

  return { statusCode: 200, body: JSON.stringify({ result: { error: `Unknown tool: ${name}` } }) };
};
```

---

## Part 3 — Edge Function: Thread signalId to Tool Execute

### `packages/edge-functions/src/chat-stream-core.ts` (or `apps/signal/netlify/edge-functions/_lib/chat-stream-core.ts`)

In the tool body building section — find the block containing `toolBody.agentId = agentId` — add immediately after:

```typescript
if (chatType === "signal") {
  toolBody.signalId = signalId;
}
```

This is the only change needed to the edge function. `signalId` is already destructured from the request body (line 223) so it's available in scope.

---

## Part 4 — System Prompt: Lean Init, Tool-aware Instructions

### `signal-chat-init.js`

**Remove:**
- `getTopChunks` import and call
- `buildEvidenceSection()` function and its output in the system prompt
- The 15-chunk static dump

**Keep:**
- Synthesized profiles (`buildProfileSection`, `buildCoverageSection`)
- All conversation approach and scoring protocol sections

**Add** to the system prompt (before CONVERSATION APPROACH):

```
== WORK HISTORY SEARCH ==
You have access to a search_work_history tool that searches ${displayName}'s real AI conversation history.

Call it when:
- You need specific evidence to score a dimension (e.g., visitor mentions a domain or skill)
- You want to verify whether ${displayName} has done relevant work
- Confidence on any dimension is below 0.5 and you have visitor context to search with

Do NOT call it:
- Before the visitor has said anything substantive
- More than 3 times per conversation
- With vague queries — be specific (e.g., "streaming SSE edge functions" not "technical work")

The tool returns real conversation summaries showing demonstrated capabilities. Reference them specifically in your scoring reason.
```

**Add** to `response.tools`:

```javascript
tools: [{
  name: 'search_work_history',
  description: `Search ${displayName}'s real AI conversation history for evidence relevant to what the visitor needs. Returns conversation summaries showing demonstrated skills and working patterns.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Space-separated terms to search for (e.g., "streaming SSE edge functions real-time"). Be specific — use domain terms, technologies, or skill names from the conversation.'
      }
    },
    required: ['query']
  }
}]
```

**For Erik's signal specifically**: keep the hardcoded `ERIK_CONTEXT` and `ERIK_*_PROFILE` constants (they substitute for chunk coverage when no real chunks have been processed). But remove the `getTopChunks('erik-burns', 15)` call.

---

## Part 5 — Concept Graph Expansion (optional, same pass)

The concept graph stored at `owner.contextStats.conceptGraph` enables 1-hop expansion: if the visitor says "real-time" and the graph knows `"real-time" → ["SSE", "streaming", "edge functions"]`, expand the query before scoring chunks.

In `searchChunks`, optionally accept a `conceptGraph` param and expand terms before scoring:

```javascript
function expandTerms(terms, graph) {
  const expanded = new Set(terms);
  terms.forEach(term => {
    const neighbors = graph[term] || [];
    neighbors.slice(0, 3).forEach(n => expanded.add(n.toLowerCase()));
  });
  return [...expanded];
}
```

`signal-tool-execute.js` loads the owner doc to get the graph, passes it to `searchChunks`. Adds one Firestore read per tool call but significantly improves match recall.

Whether to include this in the initial Phase 4 pass or defer is a call at execution time — the interface is the same either way.

---

## Files to Modify

| File | Change |
|------|--------|
| `netlify/functions/_services/db-signal-context.cjs` | Add `searchChunks(signalId, terms, limit)` + export |
| `netlify/functions/signal-tool-execute.js` | Implement `search_work_history` tool handler |
| `netlify/functions/signal-chat-init.js` | Remove static chunks, add tool definition + search instruction |
| `netlify/edge-functions/_lib/chat-stream-core.ts` | Pass `signalId` in `toolBody` when `chatType === "signal"` |

---

## Verification

1. Start a widget conversation as "recruiter" — say "we're building a real-time data pipeline and need a senior AI engineer"
2. Watch the `tool_start` / `tool_complete` SSE events appear (visible in browser network tab)
3. The agent's response should reference specific conversations from the search result
4. FIT_SCORE_UPDATE reason should cite evidence by title/date, not generic phrases
5. Try a domain the owner hasn't worked in — agent should say so honestly (0 chunks found)
6. Verify tool is called ≤ 3 times in a 10-turn conversation
7. Verify base system prompt is significantly shorter (no 15-chunk dump)

---

## Not in Phase 4

- Vector/embedding search (Pinecone, Weaviate) — Firestore concept matching is sufficient for now; upgrade path is clear
- Streaming tool result display in UI — tool_start/tool_complete events are already emitted by the edge fn but not shown to the visitor; leave invisible for now
- Cross-owner similarity — deferred to Phase 5
