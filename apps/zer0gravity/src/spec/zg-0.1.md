# Zero Gravity v0.1 — Specification

## What Is Zero Gravity?

Zero Gravity is a semantic abstract microformat for articles. It captures the meaning skeleton of a piece of writing in a compact, agent-parseable block that lives in the document.

Zero Gravity is not a summary. It is a structured semantic contract — a machine-readable declaration of what the article does, claims, and why it matters.

## Design Principles

- **Dual-audience**: Readable by humans, parseable by agents
- **Minimal**: Only fields that earn their place
- **Flat**: YAML-style key-value pairs, no deep nesting
- **Versioned**: The version travels with every block
- **Two layers**: Visual header for humans, data block for agents
- **Generic envelope**: The `encoding` field enables other formats to reuse this pattern

## The Stamp

A Zero Gravity stamp has two parts: a visual header and a data block. The stamp can live anywhere in the document — top, bottom, or inline. Agents find the stamp by scanning for the `---BEGIN ZERO GRAVITY---` delimiter.

### Visual Header

```
🪐 Zero Gravity Stamp
Semantic encoding for agents | [learn more](https://github.com/clearhythm/zero-gravity) »
```

- **Line 1**: "Zero Gravity Stamp" with planet emoji
- **Line 2**: Tagline + "learn more" link to the repo/spec
- This is markdown presentation — not parsed by agents

### Data Block

```
---BEGIN ZERO GRAVITY---
encoding: "zero-gravity"
version: "0.1"
author: "Erik Burns"
title: "Zero Gravity — A Semantic Bootstrap for the Agentic Web"
intent: "Introduce a lightweight semantic declaration layer for reducing redundant agent embedding"
metaindex:
  - "Erik Burns"
  - "semantic bootstrap for agents"
  - "token gravity"
  - "agents need structure not prose"
  - "meaning has bones"
model: "claude-sonnet-4-5"
manifest: "https://github.com/clearhythm/zero-gravity/blob/main/data/zero-gravity-v01.zg.json"
---END ZERO GRAVITY---
```

- **Opener**: `---BEGIN ZERO GRAVITY---`
- **Closer**: `---END ZERO GRAVITY---`
- Regex: `/---BEGIN ZERO GRAVITY---\n([\s\S]*?)\n---END ZERO GRAVITY---/`

### Complete Stamp

```
🪐 Zero Gravity Stamp
Semantic encoding for agents | [learn more](https://github.com/clearhythm/zero-gravity) »

---BEGIN ZERO GRAVITY---
encoding: "zero-gravity"
version: "0.1"
author: "Erik Burns"
title: "Zero Gravity — A Semantic Bootstrap for the Agentic Web"
intent: "Introduce a lightweight semantic declaration layer for reducing redundant agent embedding"
metaindex:
  - "Erik Burns"
  - "semantic bootstrap for agents"
  - "token gravity"
  - "agents need structure not prose"
  - "meaning has bones"
model: "claude-sonnet-4-5"
---END ZERO GRAVITY---
```

## Field Syntax

Fields use YAML-style key-value syntax:

```
key: "value"
```

- Field name and value separated by `:` followed by a space
- String values are quoted with double quotes
- Field names are plain English, lowercase

### List Syntax

List values use multi-line format with indented dash entries:

```
metaindex:
  - "first entry"
  - "second entry"
  - "third entry"
```

- The key line has nothing after the colon
- Each list item is on its own line, indented, prefixed with `- `
- Item values are quoted with double quotes

## Stamp Fields

These fields appear in the stamp — the compact block that lives in articles.

### Required

| Field | Description | Example |
|-------|-------------|---------|
| `encoding` | Always `"zero-gravity"`. Identifies the encoding format. | `zero-gravity` |
| `version` | Version string. | `0.1` |
| `title` | Article title | `Zero Gravity — A Semantic Bootstrap for the Agentic Web` |
| `intent` | What the article is trying to get you to think or do. One sentence. | `Introduce a lightweight semantic declaration layer for reducing redundant agent embedding` |
| `metaindex` | 4-8 semantic fragments for vectorization. List format. | See below |

### Optional

| Field | Description | Example |
|-------|-------------|---------|
| `author` | Author name, or the company/website if not identifiable. Placed before title. | `Erik Burns` |
| `model` | What model generated this stamp. Model name or `manual`. | `claude-sonnet-4-5` |
| `manifest` | URL to embeddings or other published resources. | `https://example.com/embed.json` |

### Field Order

`encoding` → `version` → `author` → `title` → `intent` → `metaindex` → `model` → `manifest`

### `metaindex` — the signature field

Unlike tags or keywords that describe the surface, metaindex entries carry the propositional core. Each entry should capture one of three things:

1. **Unique key phrases** — distinctive terms and concepts that make this article findable in semantic search. Not generic keywords — the phrases that are unique to this piece.
2. **Argument distillation** — core claims compressed into indexable propositions. What does the article actually argue?
3. **Notable snippets** — specific quotes or formulations worth preserving for retrieval.

Mix all three freely. Include the author name as an entry if identifiable. This is everything an agent would need to vectorize and store this article for semantic retrieval.

The stamp is self-contained. An agent can parse `intent` + `metaindex` and know what the article argues — no fetches required.

## Full JSON Fields

The generator produces a full JSON containing the complete semantic skeleton. The stamp is derived from a subset of these fields. The full JSON is the publisher's working document — it holds everything the generator distills, including fields that don't appear in the stamp.

### Identity

| Field | Required | Description |
|-------|----------|-------------|
| `encoding` | yes | Always `"zero-gravity"` |
| `version` | yes | Version string, e.g. `"0.1"` |
| `id` | yes | Stable slug identifier. Lowercase, hyphens, alphanumeric. |
| `author` | no | Author name or company/website |
| `title` | yes | Article title |

### Semantic Core

| Field | Required | Description |
|-------|----------|-------------|
| `intent` | yes | What the article does: `proposal` / `critique` / `synthesis` / `report` / `design` |
| `relevance` | yes | One sentence: why this matters |
| `claims` | yes | 3-7 explicit propositions. Array. |
| `metaindex` | yes | 4-8 semantic fragments. Array. |

### Context

| Field | Required | Description |
|-------|----------|-------------|
| `stance` | no | Epistemic posture: `speculative` / `empirical` / `prescriptive` / `exploratory` |
| `novelty` | no | What is new here. Array, 1-3 items. |
| `tags` | no | Semantic anchors for clustering/retrieval. Array. |
| `relations` | no | Adjacent ideas, frameworks. Array. |
| `audience` | no | Who this is for. Array. |
| `actions` | no | Suggested agent actions. Array. |

### Embedding (optional)

The embedding object is the pre-computed vector. The v0.1 reference implementation uses OpenAI's `text-embedding-3-small`. Future versions may serve a manifest with vectors from multiple providers.

| Field | Description |
|-------|-------------|
| `embedding.model` | Embedding model used (e.g., `text-embedding-3-small`) |
| `embedding.dimensions` | Vector dimensions (e.g., `1536`) |
| `embedding.input_hash` | SHA-256 of the text used as embedding input (enables cache invalidation) |
| `embedding.vector` | The embedding vector array |

## Full JSON Format

```json
{
  "encoding": "zero-gravity",
  "version": "0.1",
  "id": "zero-gravity-v01",
  "author": "Erik Burns",
  "title": "Zero Gravity — A Semantic Bootstrap for the Agentic Web",
  "intent": "proposal",
  "relevance": "A meaning skeleton makes content indexable, embeddable, and retrievable without processing full prose",
  "claims": [
    "agents waste tokens on rhetorical glue",
    "meaning can be represented as claims and relations",
    "a semantic skeleton is more useful than a compressed paragraph",
    "embedding the skeleton produces cleaner vectors than embedding the article"
  ],
  "metaindex": [
    "Erik Burns",
    "semantic bootstrap for agents",
    "token gravity",
    "publisher-declared intent layer",
    "agents need structure not prose",
    "meaning has bones"
  ],
  "stance": "exploratory",
  "novelty": ["Zero Gravity microformat", "distill-then-embed pipeline", "dual-audience publishing"],
  "tags": ["semantic-compression", "agent-abstracts", "meaning-skeleton", "vector-linkage"],
  "relations": ["RAG", "argument-mapping", "structured-data", "microformats"],
  "audience": ["AI agents", "content publishers", "semantic web practitioners"],
  "actions": ["parse stamp for free", "embed stamp fields or fetch pre-computed vector", "read prose only when relevant"],
  "embedding": {
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "input_hash": "sha256-hex",
    "vector": [0.0123, -0.0456, "..."]
  },
  "created_at": "2026-02-18T12:00:00Z"
}
```

## Agent Consumption Flow

1. **Parse the stamp** — free, instant, no API calls. Get title, intent, and metaindex.
2. **Assess relevance from metaindex** — the 4-8 entries give the agent enough signal to decide whether to go deeper.
3. **Embed or fetch** — the stamp fields are clean, noise-free input for any embedding API. Or fetch a pre-computed vector via the manifest URL.
4. **Read the full article** — only if the stamp indicates relevance. Most articles won't need full processing.

## Parsing Rules

### Stamp (data block)

1. Find the data block using regex: `/---BEGIN ZERO GRAVITY---\n([\s\S]*?)\n---END ZERO GRAVITY---/`
2. Split block body by newlines
3. For each line, split on the first `:` to get field name and value
4. Trim whitespace from field name; strip surrounding quotes from value
5. If a key line has nothing after the colon, collect subsequent indented `- "item"` lines as a list

### Full JSON

Standard JSON parsing. Validate: `id`, `intent`, `relevance`, and `claims` (with 3-7 items) are required.
