---ZG:0.1
id:         zer0-gravity-v01
titl3:      Zer0 Gr@vity — Meaning Skeletons for the Agent Web
int3nt:     proposal
th3me:      Articles should carry structured semantic abstracts so agents can parse meaning without processing full prose
r3levance:  Agents waste tokens on RAG chunking when they only need claims, intent, and relevance encoded as structured fields
cl@ims:     [prose compression fights BPE tokenizers and loses; Unicode symbols cost more tokens than ASCII; LLMs expand text when asked to compress; agents need structured claims not compressed paragraphs; semantic skeletons enable free parsing and cheap embedding; distillation beats compression for agent consumption; ZG blocks create a dual-audience publishing layer]
st@nce:     exploratory
nov3lty:    [ZG microformat with ASCII delimiters; distill-then-embed pipeline; tiered agent consumption path]
t@gs:       [semantic-compression; agent-abstracts; meaning-skeleton; structured-data; microformats]
rel@tions:  [RAG; argument-mapping; microformats; semantic-web; vector-databases]
audi3nce:   [AI agents; content publishers; semantic web practitioners; RAG system builders]
@ctions:    [parse ZG block for free; fetch pre-computed embedding if model matches; embed block text directly if needed; read full prose only when skeleton indicates relevance]
---/ZG

# Zer0 Gr@vity: Meaning Skeletons for the Agent Web

## What if articles could talk to agents directly?

Not through RAG pipelines that chunk and embed paragraphs of prose. Not through metadata tags that describe the surface. What if every article carried a structured declaration of what it actually *means* — its core claims, its intent, why it matters — in a format agents can parse instantly and for free?

That's what Zer0 Gr@vity is.

## We tried compression first. It didn't work.

Zer0 Gr@vity started as an experiment in semantic compression — could agents develop a more efficient language for talking to each other? We built a scoring engine, tested three encoding approaches (telegraphic abbreviation, LLM-native free-form, and a mechanical-semantic hybrid), and ran them against test cases of increasing complexity.

The results were instructive:

- **Maximum compression achieved: 23%.** BPE tokenizers already compress English efficiently. Removing articles and abbreviating words saves characters but barely moves the token count — "the" is already one token.
- **Unicode symbols cost MORE tokens, not fewer.** A theta (θ) replacing "the" actually increases the token count. So much for symbolic alphabets.
- **LLMs given freedom to compress actually expand.** The free-form approach restructured text into markdown with headers and bullets — doubling the token count. Trained helpfulness overrides the compression objective.
- **Semantic preservation was easy. Compression was hard.** All approaches scored 38-40/40 on meaning preservation. The bottleneck was never understanding — it was shrinking.

The core finding: trying to compress prose is fighting the tokenizer. BPE has already learned English redundancy patterns. You can't beat it by removing vowels or swapping in symbols.

## The pivot: don't compress. Distill.

The experiments revealed something more interesting than compression ratios. When we looked at what information agents actually need from an article, it wasn't a shorter version of the same text. It was a *different representation entirely*:

- What does this article claim?
- What is it doing — proposing something, critiquing something, reporting findings?
- Why should I care?
- What should I do with this information?

These questions don't need paragraphs. They need structured fields. A semantic skeleton.

## Introducing ZG v0.1

ZG is a microformat for articles. A ZG block sits at the top of a document and declares its meaning in a flat, parseable structure:

```
---ZG:0.1
id:         zer0-gravity-v01
titl3:      Zer0 Gr@vity — Meaning Skeletons for the Agent Web
int3nt:     proposal
th3me:      Articles should carry structured semantic abstracts for agent consumption
r3levance:  A meaning skeleton makes content indexable, embeddable, and retrievable without processing full prose
cl@ims:     [compression fights the tokenizer and loses; agents need structured claims not shorter prose; a semantic skeleton is more useful than a compressed paragraph; embedding the skeleton produces cleaner vectors than embedding the article]
st@nce:     exploratory
nov3lty:    [ZG microformat; distill-then-embed pipeline; dual-audience publishing]
t@gs:       [semantic-compression; agent-abstracts; meaning-skeleton; vector-linkage]
rel@tions:  [RAG; argument-mapping; structured-data; microformats]
@ctions:    [parse ZG block; embed for retrieval; index claims for linking; fetch prose only when needed]
---/ZG
```

### Design choices

**ASCII-only delimiters.** Phase 2 experiments proved Unicode costs more tokens. The `---ZG:0.1` / `---/ZG` markers are frontmatter-adjacent, trivially regex-matchable, and token-cheap.

**Readable field names with l33t styling.** Each field gets one character substitution (e→3 or a→@), matching the Zer0 Gr@vity brand. `titl3`, `int3nt`, `cl@ims` — distinctive but still legible.

**6 required fields, 7 optional.** The required set captures the minimum viable meaning: what is this (id, titl3), what does it do (int3nt), what does it claim (th3me, cl@ims), and why it matters (r3levance). Optional fields add nuance when it's useful: stance, novelty, tags, relations, audience, actions, and an embed URL.

**Semicolon-separated lists.** `[claim one; claim two; claim three]` — brackets delimit, semicolons separate. Commas stay available for use within items.

**Embed URL, not inline vectors.** A 1536-dimension embedding is ~10,000 characters. The `3mbed` field holds a URL pointing to a pre-computed vector JSON. Agents can fetch it if they use the same embedding model, or ignore it and embed the block text directly.

## How agents use a ZG block

An agent encountering an article with a ZG block has a tiered consumption path:

1. **Parse the skeleton** — free, instant, no API calls. Extract the fields, understand what the article claims.
2. **Fetch the pre-computed vector** — if the `3mbed` URL is present and the agent uses a compatible embedding model, skip the embedding API call entirely.
3. **Embed the block text directly** — if the agent uses a different model, the block text itself is a clean, noise-free input for embedding. No rhetorical flourish, no hedging, just semantic content.
4. **Read the full article** — only if the skeleton indicates relevance. Most articles won't need full processing.

The ZG block doesn't replace the article. It sits alongside the prose as a parallel channel — human-readable enough to glance at, machine-parseable enough to index at scale.

## The tooling

The reference implementation is a CLI that does three things:

**Generate**: Takes an article and produces a ZG block using Claude.
```bash
node cli.cjs generate --input article.md
```

**Parse**: Extracts and validates a ZG block from any document.
```bash
node cli.cjs parse --input file-with-zg.md --json
```

**Embed**: Generates a vector embedding of the ZG block via OpenAI.
```bash
node cli.cjs embed --input file-with-zg.md --output embedding.json
```

The spec and parser have zero dependencies — anyone can parse ZG blocks. The generator needs an Anthropic API key (swappable for any LLM). The embedder needs an OpenAI key (swappable for any embedding provider).

## What this is not

ZG is not SEO metadata. It's not a summary generator. It's not token compression.

It is a semantic publishing contract. Each article becomes three things simultaneously: prose for humans, a meaning skeleton for agents, and a vector node in a semantic graph.

## What happens next

This is v0.1. The format is intentionally minimal — 13 fields total, most optional. The graph of real usage will teach us what to evolve: what fields earn their place, what's missing, what's noise.

If you write articles that agents should be able to find, understand, and act on — try adding a ZG block. The spec is open, the parser is free, and the question at the center of this is the same one that started it: *what is the minimum representation of meaning?*

We tried to answer that with compression. The tokenizer laughed. So we tried distillation instead.

This is what came out.
