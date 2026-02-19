# ZG v0.1 — Specification

## What Is ZG?

ZG (Zer0 Gr@vity) is a semantic abstract microformat for articles. It captures the meaning skeleton of a piece of writing in a compact, agent-parseable block that lives at the top of the document.

ZG is not a summary. It is a structured semantic contract — a machine-readable declaration of what the article does, claims, and why it matters.

## Design Principles

- **Dual-audience**: Readable by humans, parseable by agents
- **Minimal**: Only fields that earn their place
- **Flat**: One field per line, no nesting
- **ASCII-only delimiters**: No Unicode overhead (tokenizers penalize it)
- **Versioned**: The version travels with every block
- **l33t-styled**: One character substitution per field name (e→3, a→@)

## Block Structure

A ZG block is enclosed in ASCII delimiters and placed at the top of an article:

```
---ZG:0.1
id:         my-article-slug
titl3:      My Article Title
int3nt:     proposal
th3me:      The one-sentence core point of this article
r3levance:  Why this matters in one sentence
cl@ims:     [first claim; second claim; third claim]
---/ZG
```

### Delimiters

- **Opener**: `---ZG:0.1` (version number follows the colon)
- **Closer**: `---/ZG`
- Regex: `/^---ZG:(\d+\.\d+)\s*\n([\s\S]*?)\n---\/ZG\s*$/m`

### Field Syntax

Each field occupies one line:

```
fieldname:  value
```

- Field name and value are separated by `:` followed by one or more spaces
- Field names are lowercase with l33t substitutions
- Values are plain text (single-line)

### List Syntax

List values use semicolon-separated bracketed notation:

```
cl@ims:  [first claim; second claim; third claim]
```

- Brackets `[` `]` delimit the list
- Semicolons `;` separate items
- Whitespace around items is trimmed

## Fields

### Required (6)

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Stable slug identifier. Lowercase, hyphens, alphanumeric. Unique within an author's body of work. | `zer0-gravity-v01` |
| `titl3` | Short article title. | `Zer0 Gr@vity — Meaning Skeletons for the Agent Web` |
| `int3nt` | What the article does. Controlled vocabulary: `proposal` / `critique` / `synthesis` / `report` / `design` | `proposal` |
| `th3me` | One-sentence core point. The single most important idea. | `Agents need meaning-skeletons not prose to link ideas and act reliably` |
| `r3levance` | One sentence: why this matters. | `A semantic abstract makes indexing cheaper and retrieval clearer` |
| `cl@ims` | 3-7 explicit propositions. List format. | `[agents waste tokens on glue; meaning reduces to claims; ZG is a publishable layer]` |

### Optional (7)

| Field | Description | Example |
|-------|-------------|---------|
| `st@nce` | Epistemic posture: `speculative` / `empirical` / `prescriptive` / `exploratory` | `exploratory` |
| `nov3lty` | What is new here. List format, 1-3 items. | `[ZG microformat; distill-then-embed pipeline]` |
| `t@gs` | Semantic anchors for clustering and retrieval. List format. | `[semantic-compression; agent-abstracts]` |
| `rel@tions` | Adjacent ideas, frameworks, or schools of thought. List format. | `[RAG, argument-mapping, structured-data]` |
| `audi3nce` | Who this is for. List format. | `[AI agents, developers]` |
| `@ctions` | Suggested agent actions or processing hints. List format. | `[index ZG block; embed for retrieval]` |
| `3mbed` | URL to pre-computed embedding JSON. | `https://raw.githubusercontent.com/.../embed.json` |

## Complete Example

```
---ZG:0.1
id:         zer0-gravity-v01
titl3:      Zer0 Gr@vity — Meaning Skeletons for the Agent Web
int3nt:     proposal
th3me:      Agents need meaning-skeletons not prose to link ideas and act reliably
r3levance:  A semantic abstract makes indexing cheaper and retrieval clearer
cl@ims:     [agents waste tokens on rhetorical glue; meaning can be represented as claims and relations; ZG blocks are a publishable semantic layer; embedding ZG enables graph linkage; artistry belongs in the prose layer]
st@nce:     exploratory
nov3lty:    [ZG microformat; distill-then-embed pipeline; dual-audience publishing]
t@gs:       [semantic-compression; agent-abstracts; meaning-skeleton; vector-linkage]
rel@tions:  [RAG, argument-mapping, structured-data]
audi3nce:   [AI agents, developers, semantic web practitioners]
@ctions:    [index ZG blocks; embed for retrieval; fetch prose only when needed]
3mbed:      https://raw.githubusercontent.com/user/repo/main/embeddings/zer0-gravity-v01.json
---/ZG
```

## Embedding JSON Format

When the `3mbed` field is present, the URL should point to a JSON file with this structure:

```json
{
  "zg_id": "zer0-gravity-v01",
  "zg_version": "0.1",
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "input_hash": "sha256-hex-of-zg-block-text",
  "created_at": "2026-02-18T12:00:00Z",
  "vector": [0.0123, -0.0456, ...]
}
```

The `input_hash` is SHA-256 of the ZG block text (everything between delimiters, inclusive). If the hash doesn't match the current block, the embedding is stale and should be regenerated.

## Parsing Rules

1. Find the block using the delimiter regex
2. Extract the version from the opener
3. Split block body by newlines
4. For each line, split on the first `:` to get field name and value
5. Trim whitespace from both field name and value
6. If value starts with `[` and ends with `]`, parse as list (split on `;`, trim items)
7. Validate: all 6 required fields must be present

## What Is NOT in v0.1

These fields are deferred until real usage demands them:

- `tone` — affect/vibe
- `vals` — values orientation
- `ctx` — context assumptions
- `risk` — failure modes
- `refs` — references
- `sig` — voice continuity marker
- `conf` — confidence estimate
- `q` — open research questions
