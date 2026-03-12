# Signal Build — Phase 3: Data Pipeline

> **Status:** PENDING (start after Phase 2 is reviewed and stable)
> When phase is complete, rename to `REVIEW-signal-build-phase3.md`

## Goal

Replace manually entered context text with actual AI conversation history as the scoring data source. Makes the Fit Score grounded in verified work behavior rather than a bio someone typed.

This is the core differentiator: your Signal knows what you actually do, not what you claim.

---

## Supported Data Sources

| Source | Format | Priority |
|--------|--------|----------|
| Claude Projects | JSON export from claude.ai | P0 |
| ChatGPT | JSON export from chat.openai.com | P1 |
| HabitualOS internal | Firestore query (for Erik's own Signal) | P2 |
| Real-time feed | API polling / webhook | P3 |

---

## Pipeline Stages

### Stage 1: Ingestion
Owner uploads a JSON export (drag-and-drop or file input on dashboard).
Server parses it into conversation records.

```
signal-context-chunks/{signalId}/{chunkId}:
  signalId: string
  source: "claude" | "chatgpt" | "habitualos"
  title: string           # Conversation title
  date: ISO string
  topics: string[]        # Extracted topics
  skills: string[]        # Demonstrated skills
  summary: string         # 2-4 sentence summary of conversation
  rawExcerpt: string      # Key excerpt (for RAG retrieval)
  embedding: number[]     # Stored for semantic search
  _createdAt: Timestamp
```

### Stage 2: Extraction
A one-time processing function that takes raw conversation JSON and extracts:
- Topics discussed
- Skills demonstrated (with evidence)
- Problem types encountered (and how resolved)
- Work velocity indicators (short/long sessions, recovery from blockers)
- Personality signals (communication style, curiosity markers, how they frame problems)

Extraction uses Claude (owner's API key) with a structured extraction prompt.

### Stage 3: Embedding
Each chunk gets a vector embedding for semantic search at inference time.
Option: use Anthropic's embedding model, or keep it simple with keyword search in Phase 3.

### Stage 4: Retrieval at Inference Time
`signal-chat-init.js` performs a semantic (or keyword) search over the owner's context chunks
relevant to the current conversation, injects top-N as grounding evidence into the system prompt.

```js
// In signal-chat-init.js (Phase 3 version)
const relevantChunks = await searchContextChunks(signalId, {
  query: conversationSoFar,
  limit: 8
});
const contextBlock = relevantChunks.map(c => `[${c.date}] ${c.summary}\n${c.rawExcerpt}`).join('\n\n');
// Inject into system prompt before scoring protocol
```

---

## File Checklist

### Dashboard Additions
- [ ] `src/dashboard.njk` — add data section:
  - Upload Claude/ChatGPT JSON export
  - View uploaded sources (count, date range)
  - Processing status indicator
  - Delete all data option

### Backend
- [ ] `netlify/functions/signal-context-upload.js` — accept JSON export, queue processing
- [ ] `netlify/functions/signal-context-process.js` — extract + store chunks (background/scheduled)
- [ ] `netlify/functions/signal-context-search.js` — semantic/keyword search over chunks for a signalId
- [ ] Update `netlify/functions/signal-chat-init.js` — inject relevant chunks into system prompt

### Real-time Feed (stretch, P3)
- [ ] `netlify/functions/signal-sync-claude.js` — poll Claude API for new conversations (if/when API supports it)
- [ ] Scheduled Netlify function (cron) to auto-refresh context

---

## Key Questions to Resolve Before Building

1. **Privacy model**: Does the owner control which conversations are included? Or all-or-nothing?
2. **RAG vs full context**: Is semantic search needed, or can we inject a compressed summary of everything?
3. **Embedding provider**: Anthropic embeddings vs. simple TF-IDF vs. external (Pinecone, etc.)?
4. **Export format changes**: Claude and ChatGPT export schemas will drift — build parsers defensively.

---

## Env Vars Needed (additions to Phase 2)
- Possibly: vector DB credentials (if using external embedding store)
- Otherwise: Firestore is sufficient for Phase 3 keyword search
