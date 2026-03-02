# Job Search Evolution — Roadmap

## Goals

1. **Discover & learn** — surface cool companies + industry content automatically
2. **Stay current** — pull articles, thought pieces, industry signals worth reading
3. **Act on leads** — cross-reference high-scored companies with job feeds; get daily Fox-EA summary
4. **Draft content** — use collected articles as source material for writing (semantic search)
5. **Apply agentically** — resume optimization + application tracking

---

## Architecture: Two Content Streams

The existing pipeline handles **companies** well. We add a parallel **articles** stream.

```
Discovery Agent
├── Company pipeline (existing)    → companies/{name}.md
└── Article pipeline (Phase 1)     → articles/{slug}.md
                                        ↓
                               Vector store ingestion (Phase 3)
                               Article drafting with agent (Phase 3)
```

Both streams flow through the same Firestore drafts collection (`type: 'company'` vs
`type: 'article'`), same Fox-EA review flow, and same local reconciler.

---

## Phase 1: Article Discovery

See `plan-article-discovery.md` — implementation-ready, build this week.

---

## Phase 2: Job Feed Integration

> After Phase 1 is running and you have a set of scored companies.

**What to build:**
- Cross-reference high-scored companies (user_score ≥ 7) with job boards
- Daily Fox-EA summary: "Here's what looks promising today"

**Approach:**
Search for open roles at high-scored companies via Tavily queries, or integrate
directly with Lever/Greenhouse/Ashby public APIs (no auth required for many
YC/VC-backed companies).

Add a scheduled function (or extend `discovery-scheduled.js`) that fetches
high-scored companies, checks for new postings, and creates a Fox-EA action card
with the daily summary.

---

## Phase 3: Vector Store + Article Drafting

> After you have a meaningful corpus of articles (50+ files).

**What to build:**
- Local vector store over `data/{agentPath}/articles/` markdown files
- Semantic search: "find articles about PLG strategy" returns ranked results
- Agent-assisted drafting: give an idea → agent finds relevant sources → draft outline with citations

**Stack recommendation:** LanceDB — file-based like SQLite, no server, Node.js native.

**Ingestion script** (local, not a Netlify function):
```
scripts/ingest-articles.js
- Reads all articles/*.md files
- Embeds body text in chunks
- Stores in lancedb at data/{agentPath}/.vectors/
```

**Draft agent** — Fox-EA tool `search_articles(query)` returns top N relevant
chunks with source metadata. You describe the piece you want to write; agent
synthesizes a draft outline with citations.

---

## Phase 4: Agentic Application

- Resume tailoring per company/role (Claude rewrites sections based on job description)
- Application tracking (action per application: applied → phone screen → offer)
- Fox-EA coordinates: "You have 3 applications in flight, here's what to follow up on"

---

## Implementation Order

| Phase | Scope | When |
|-------|-------|------|
| Cleanup | Delete dead code, fix env vars | First |
| 1 Article Discovery | New pipeline + reconciler update | This week |
| 2 Job Feed | Daily summary + job matching | After Phase 1 stable |
| 3 Vector Store | LanceDB + ingestion + draft agent | After 50+ articles |
| 4 Agentic Application | Resume + tracking | Later |
