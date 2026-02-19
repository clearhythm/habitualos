# Zer0 Gr@vity — ZG v0.1 Reference Architecture

## Overview

This document defines the processing and embedding architecture for ZG v0.1 microformat blocks.

Goals:

- Extract ZG blocks deterministically
- Normalize into canonical JSON
- Generate stable embeddings
- Support encoder-agnostic pipelines
- Enable semantic linkage and graph building

---

# 1. Article Artifact Structure

For each article:

- article.md (human prose + ZG block at top)
- zg.json (parsed canonical representation)
- embed.json (vector + metadata)
- optional: links.json (computed neighbors)

---

# 2. Processing Pipeline

## Step 1 — Extract

Locate text between:

⟪ZG·0.1⟫
...
⟫

## Step 2 — Parse

Convert to canonical JSON structure:

{
  "version": "0.1",
  "id": "...",
  "title": "...",
  "move": "...",
  "stance": "...",
  "tone": "...",
  "thesis": "...",
  "why": "...",
  "claims": [...],
  "novelty": [...],
  "tags": [...],
  "relations": [...],
  "use": [...]
}

---

# 3. Canonical Text for Embedding

Before embedding, generate a normalized canonical string:

ZG|v0.1
TITLE: ...
MOVE: ...
STANCE: ...
TONE: ...
THESIS: ...
WHY: ...
CLAIMS:
(1) ...
(2) ...
NOVEL:
...
TAGS:
...
REL:
...
VALUES:
...
USE:
...

This reduces instability caused by formatting variance.

---

# 4. Embedding Strategy

System must remain encoder-agnostic.

Supported encoders may include:

- Nomic embed text v1.5 (local-first)
- OpenAI text-embedding-3-small
- Cohere Embed v3
- Any encoder via adapter interface

---

# 5. Encoder Adapter Interface

Pseudo-interface:

embed(text, { model, dimensions }) -> vector[]

Claude Code implementation may include:

- Local embedding adapter
- API embedding adapter
- Model registry
- Fallback encoder

---

# 6. Embedding Metadata

Store alongside vector:

{
  "model": "nomic-embed-text-v1.5",
  "dimensions": 256,
  "created_at": "ISO timestamp",
  "input_hash": "sha256-of-canonical-text",
  "zg_version": "0.1"
}

Hash canonical text before embedding.
If hash changes, regenerate embedding.

---

# 7. Linking Strategy

Two-layer linkage approach:

1. Vector similarity (cosine distance)
2. Symbolic linkage via tags, rel, vals

Hybrid linking improves precision and reduces noise.

Optional advanced pattern:

- vec_zg for semantic linkage
- vec_full for deep retrieval

---

# 8. Why Embed Only ZG?

Embedding the ZG block:

- Reduces rhetorical noise
- Improves semantic clarity
- Produces cleaner graph structure
- Is cheaper and faster
- Captures what matters

Full-text embedding can remain optional.

---

# 9. Design Intent

This system is:

- Not token optimization
- Not lossy compression
- Not SEO metadata
- Not a summary generator

It is a semantic publishing contract.

Each article becomes:

- Prose for humans
- Meaning skeleton for agents
- Vector node in a semantic graph

Version 0.1 is intentionally minimal.
The graph will teach what to evolve next.

