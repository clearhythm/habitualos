# Zer0 Grav1ty v0.1 — Specification

## What Is Zer0 Grav1ty?

Zer0 Grav1ty is a semantic abstract microformat for articles. It captures the meaning skeleton of a piece of writing in a compact, agent-parseable block that lives in the document.

Zer0 Grav1ty is not a summary. It is a structured semantic contract — a machine-readable declaration of what the article does, claims, and why it matters.

## Design Principles

- **Dual-audience**: Readable by humans, parseable by agents
- **Minimal**: Only fields that earn their place
- **Flat**: One field per line, no nesting
- **ASCII-only**: No Unicode overhead (tokenizers penalize it)
- **Versioned**: The version travels with every block
- **Two layers**: Visual header for humans, data block for agents

## The Stamp

A Zer0 Grav1ty stamp has two parts: a visual header and a data block. The stamp can live anywhere in the document — top, bottom, or inline. A lightweight signal near the top (e.g., `🪐 This article is Zer0 Grav1ty encoded`) can anchor-link to the stamp for human discoverability. Agents find the stamp by scanning for the `--zg:` delimiter.

### Visual Header

```
Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://github.com/.../zg-0.1.md)
```

- **Line 1**: The brand name `Zer0 Grav1ty`
- **Line 2**: Tagline + a "what's this?" link to the spec
- This is presentation — not parsed by agents

### Data Block

```
--zg:0.1
+ title: Zer0 Grav1ty — Meaning Skeletons for the Agent Web
+ author: Erik Willekens
+ theme: Articles should carry structured semantic abstracts for agent consumption
+ index: [distillation beats compression; agents need structure not prose; meaning has bones]
+ embed: https://example.com/zer0-gravity-v01.embed.json
+ model: claude-sonnet-4-5
--/zg
```

- **Opener**: `--zg:0.1` (version number follows the colon)
- **Closer**: `--/zg`
- Regex: `/^--zg:(\d+\.\d+)\s*\n([\s\S]*?)\n--\/zg\s*$/m`

### Complete Stamp

```
Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://github.com/.../zg-0.1.md)
--zg:0.1
+ title: Zer0 Grav1ty — Meaning Skeletons for the Agent Web
+ author: Erik Willekens
+ theme: Articles should carry structured semantic abstracts for agent consumption
+ index: [distillation beats compression; agents need structure not prose; meaning has bones]
+ embed: https://example.com/zer0-gravity-v01.embed.json
+ model: claude-sonnet-4-5
--/zg
```

## Field Syntax

Each field occupies one line, prefixed with `+`:

```
+ fieldname: value
```

- Fields start with `+ ` (plus, space)
- Field name and value are separated by `:` followed by one or more spaces
- Field names are plain English, lowercase
- Values are plain text (single-line)

### List Syntax

List values use semicolon-separated bracketed notation:

```
+ index: [first entry; second entry; third entry]
```

- Brackets `[` `]` delimit the list
- Semicolons `;` separate items
- Whitespace around items is trimmed

## Stamp Fields (6)

These fields appear in the stamp — the compact block that lives in articles.

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `title` | yes | Article title | `Zer0 Grav1ty — Meaning Skeletons for the Agent Web` |
| `author` | no | Author name or attribution | `Erik Willekens` |
| `theme` | yes | One-sentence core point. The single most important idea. | `Articles should carry structured semantic abstracts for agent consumption` |
| `index` | yes | 2-4 entries for semantic indexing. Captures three things: unique key phrases (for findability), argument distillation (core claims as propositions), and notable snippets (quotes worth preserving). List format. | `[distillation beats compression; agents need structure not prose; meaning has bones]` |
| `embed` | no | URL to a pre-computed embedding (vector + metadata) | `https://example.com/zer0-gravity-v01.embed.json` |
| `model` | no | What model generated this stamp. Model name or `manual`. | `claude-sonnet-4-5` |

The stamp is self-contained. An agent can parse `theme` + `index` and know what the article argues — no fetches required.

The `index` field is the signature innovation. Unlike tags or keywords that describe the surface, index entries carry the propositional core — unique key phrases, distilled arguments, and notable snippets. This is everything an agent would need to vectorize and store this article for semantic retrieval.

The optional `embed` URL saves agents an embedding API call by providing a pre-computed vector. The publisher embeds once; every agent benefits.

## Full JSON Fields

The generator produces a full JSON containing the complete semantic skeleton. The stamp is derived from these fields. The full JSON is the publisher's working document — it holds everything the generator distills, including fields that don't appear in the stamp.

### Identity

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable slug identifier. Lowercase, hyphens, alphanumeric. |
| `title` | yes | Article title |
| `author` | no | Author name |
| `url` | no | URL to the article itself |

### Semantic Core

| Field | Required | Description |
|-------|----------|-------------|
| `intent` | yes | What the article does: `proposal` / `critique` / `synthesis` / `report` / `design` |
| `theme` | yes | One-sentence core point |
| `relevance` | yes | One sentence: why this matters |
| `claims` | yes | 3-7 explicit propositions. Array. |

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

The embedding object is the pre-computed vector that lives at the stamp's `embed` URL. The v0.1 reference implementation uses OpenAI's `text-embedding-3-small`. Future versions may serve a manifest with vectors from multiple providers.

| Field | Description |
|-------|-------------|
| `embedding.model` | Embedding model used (e.g., `text-embedding-3-small`) |
| `embedding.dimensions` | Vector dimensions (e.g., `1536`) |
| `embedding.input_hash` | SHA-256 of the text used as embedding input (enables cache invalidation) |
| `embedding.vector` | The embedding vector array |

## Full JSON Format

```json
{
  "zg_version": "0.1",
  "id": "zer0-gravity-v01",
  "title": "Zer0 Grav1ty — Meaning Skeletons for the Agent Web",
  "author": "Erik Willekens",
  "url": "https://example.com/article",
  "intent": "proposal",
  "theme": "Articles should carry structured semantic abstracts for agent consumption",
  "relevance": "A meaning skeleton makes content indexable, embeddable, and retrievable without processing full prose",
  "claims": [
    "compression fights the tokenizer and loses",
    "agents need structured claims not shorter prose",
    "a semantic skeleton is more useful than a compressed paragraph",
    "embedding the skeleton produces cleaner vectors than embedding the article"
  ],
  "stance": "exploratory",
  "novelty": ["Zer0 Grav1ty microformat", "distill-then-embed pipeline", "dual-audience publishing"],
  "tags": ["semantic-compression", "agent-abstracts", "meaning-skeleton", "vector-linkage"],
  "relations": ["RAG", "argument-mapping", "structured-data", "microformats"],
  "audience": ["AI agents", "content publishers", "semantic web practitioners", "RAG system builders"],
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

1. **Parse the stamp** — free, instant, no API calls. Get title, theme, and index entries.
2. **Assess relevance from index** — the 2-4 index entries give the agent enough signal to decide whether to go deeper.
3. **Embed or fetch** — the stamp fields are clean, noise-free input for any embedding API. Or if `embed` is present, fetch the pre-computed vector (one HTTP request, zero compute).
4. **Read the full article** — only if the stamp indicates relevance. Most articles won't need full processing.

## Parsing Rules

### Stamp (data block)

1. Find the data block using regex: `/^--zg:(\d+\.\d+)\s*\n([\s\S]*?)\n--\/zg\s*$/m`
2. Extract the version from the opener
3. Split block body by newlines
4. For each line, strip the `+ ` prefix, then split on the first `:` to get field name and value
5. Trim whitespace from both field name and value
6. If value starts with `[` and ends with `]`, parse as list (split on `;`, trim items)

### Full JSON

Standard JSON parsing. Validate: `id`, `intent`, `theme`, `relevance`, and `claims` (with 3-7 items) are required.

## What Is NOT in v0.1

These are deferred until real usage demands them:

- `tone` — affect/vibe
- `vals` — values orientation
- `ctx` — context assumptions
- `risk` — failure modes
- `refs` — references
- `sig` — voice continuity marker
- `conf` — confidence estimate
- `q` — open research questions
- Micro vectors — compact inline directional embeddings (exploring for v0.2)

## Future Direction

- **Embedding manifests.** The `embed` URL currently points to a single vector (OpenAI `text-embedding-3-small`). Future versions could serve a manifest with vectors from multiple providers (OpenAI, Cohere, Voyage, etc.) so agents grab the representation matching their model.
- **Native HTML.** If stamps become a web standard, the format could collapse to two native concepts: `metaindex` (the semantic skeleton — theme + index entries) and `metaembed` (pre-computed vector). The stamp is the bootstrap — a format that works today, inside articles, without waiting for browser vendors.
- **Discovery.** A registry of ZG-stamped articles, enabling semantic search across publishers.
