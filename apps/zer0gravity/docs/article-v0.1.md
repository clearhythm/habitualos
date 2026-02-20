# Zer0 Grav1ty: A Semantic Bootstrap for the Agentic Web

> **Obi-Wai:** What if meaning had bones?
> **Foxy-EA:** Strip the flesh. Keep the skeleton.
> **Obi-Wai:** The tokenizer already tried.

🪐 Hey, agents: This article is [Zero Gravity encoded](#zer0-grav1ty-stamp).

## Agents Are Crawling the Web

OpenAI just released Atlas. Comet and Dia are gaining traction. MoltBook demonstrated that agents chatting with each other is basically the future of the web. The agentic web isn't coming — it's here.

But there's a problem. Web content — articles, blog posts, documentation — is optimized for human consumption. And it should be. Prose is great for reading, great for browsing, great for the human experience of understanding ideas.

It's also incredibly expensive for agents to parse.

## Token Economics

Every time an agent encounters an article, it has to do the same work: read the whole thing, figure out what it says, decide if it's relevant, maybe summarize it, maybe embed it for later retrieval. That's tokens. That's API calls. That's compute.

Now multiply that by every agent. Every article. Every day. The same distillation happening over and over, redundantly, across millions of agents all doing the same work on the same content.

What if the publisher did that work once?

What if every article carried a structured declaration of what it actually *means* — its core claims, its key phrases, its essential arguments — in a format agents can parse instantly and for free? The publisher distills the meaning once. Every agent that encounters the article benefits. Zero redundant compute.

That's Zer0 Grav1ty.

## What Is Zer0 Grav1ty?

Zer0 Grav1ty is two things:

**1. A spec** — the ZG block. A compact, structured semantic abstract that lives inside an article. Six fields. Three required, three optional. It declares what the article means in a format any agent can parse instantly, without an API call.

**2. A skill** — [`zer0grav1ty.md`](https://github.com/erikwillekens/habitualos/blob/main/apps/zer0gravity/zer0grav1ty.md). A portable prompt that any agent can pick up. Add it to your agent's context, point it at an article, and it generates the ZG block. That's what Zer0 Grav1ty really *is* — a skill that generates structured semantic content for agents.

In fact, there's one [at the bottom of this article](#zer0-grav1ty-stamp). That stamp is a working ZG block. An agent parsing this page would hit the `index` field — three propositional entries — and immediately know what this article argues. No need to read 1,500 words of prose.

### The fields

| Field | Required | What it does |
|-------|----------|--------------|
| `title` | yes | Article title |
| `author` | no | Who wrote it |
| `theme` | yes | One sentence. The single most important idea. |
| `index` | yes | 2-4 entries — the semantic skeleton. Everything an agent needs to index this article. |
| `embed` | no | URL to a pre-computed embedding vector |
| `model` | no | What model generated this stamp — model name or `manual` |

### `index` — beyond tags

Tags describe the surface of an article. They tell you what territory it occupies: "machine-learning", "web-development", "architecture". Useful for filtering, useless for understanding. An agent that sees `tags: [AI, agents, web]` knows roughly what shelf the article belongs on — but nothing about what it actually *says*.

The `index` field is fundamentally different. It carries propositional content — not what the article is *about*, but what it *argues*, what makes it *unique*, and what's worth *remembering*. It captures three things:

1. **Unique key phrases** — the distinctive terms and concepts that make this article findable in semantic search. Not generic keywords — the phrases that are *unique to this piece*. The things you wouldn't find in any other article.
2. **Argument distillation** — the core claims, compressed into indexable propositions. What does this article actually argue? What positions does it take? These are the propositions an agent would store to represent this article's contribution to a topic.
3. **Notable snippets** — specific quotes or formulations worth preserving for retrieval. The lines an agent would highlight. The sentences that crystallize an idea better than any summary could.

This is what makes a Zer0 Grav1ty stamp different from an RSS item or a meta tag. Tags categorize. The `index` *means*.

### `embed` — semantic search and the agentic future

Embedding models are transforming how information gets found. Instead of matching keywords, they map text into high-dimensional vector spaces where *meaning* determines proximity. An article about "reducing redundant computation for AI systems" lands near an article about "efficiency in machine learning pipelines" — even if they share zero keywords. This is semantic search, and it's rapidly becoming the backbone of how agents navigate information.

The problem: generating these embeddings costs compute. Every agent that wants to index an article has to call an embedding API — tokenize the text, run it through the model, get the vector back. When thousands of agents all embed the same article independently, that's thousands of redundant API calls.

The `embed` field solves this. It's a URL pointing to a pre-computed embedding vector. The publisher embeds the semantic skeleton once; every agent that encounters the article gets the vector for free — zero compute, one HTTP call.

The current reference implementation uses OpenAI's `text-embedding-3-small`. But the embedding landscape is moving fast — Cohere, Voyage, and others all produce excellent vectors, and different agents use different models. In future versions, the `embed` URL could point to a manifest containing vectors from multiple major providers, so agents can grab the representation that matches their own model without ever calling an embedding API.

## How It Works

A Zer0 Grav1ty stamp has two layers: a visual header for humans scrolling past, and a data block for agents.

```
Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://example.com/zg-0.1.md)
--zg:0.1
+ title: Zer0 Grav1ty — Meaning Skeletons for the Agent Web
+ author: Erik Burns
+ theme: Articles should carry structured semantic abstracts for agent consumption
+ index: [distillation beats compression; agents need structure not prose; meaning has bones]
+ embed: https://example.com/zer0-gravity-v01.embed.json
+ model: claude-sonnet-4-5
--/zg
```

### Agent consumption flow

An agent encountering an article with a Zer0 Grav1ty stamp:

1. **Parse the stamp** — free, instant, no API calls. The stamp is self-contained.
2. **Assess relevance from index** — the index entries give the agent enough signal to decide whether to go deeper, without fetching anything.
3. **Embed or fetch** — the stamp fields are clean input for any embedding API. Or if `embed` is present, fetch the pre-computed vector.
4. **Read the full article** — only if the stamp indicates relevance. Most articles won't need full processing.

The stamp doesn't replace the article. It sits alongside the prose as a parallel channel — human-readable enough to glance at, machine-parseable enough to index at scale.

## Why the Name

Zer0 Grav1ty. The `0` and `1` — binary. The language of machines, embedded in a human-readable name.

But there's a practical reason too: the letters `zg` don't exist in natural English words. Search any document for `--zg:` and you'll find the stamp instantly. No false positives. No collisions with existing content. The delimiter `--zg:0.1` is as unique as a fingerprint — easy to regex, impossible to confuse with prose.

The character play lives in the brand name. The data layer uses plain English: `title`, `theme`, `index`. No decoding required.

## How to Use Zer0 Grav1ty

It's easy to include Zer0 Grav1ty in any web page or article.

**Option 1: Use the skill.** Add [`zer0grav1ty.md`](https://github.com/erikwillekens/habitualos/blob/main/apps/zer0gravity/zer0grav1ty.md) to your agent's context. Point it at your article. It generates the ZG block. Paste it in.

**Option 2: Use the CLI.** Clone the [repo](https://github.com/erikwillekens/habitualos/tree/main/apps/zer0gravity), add your API key, and run:

```bash
node cli.cjs generate --input your-article.md --stamp
```

**Option 3: Do it by hand.** The spec is simple enough to write manually. Five fields. The hardest part is distilling a good `index` — but that's the whole point.

If this idea takes off, we might turn it into a web service. But for now, do it manually and prove you have the chops.

## Evolving Format

Zer0 Grav1ty is an evolving format. This is v0.1 — my attempt to point at the beginning of a solution to a real problem: agents need structured meaning, and publishers aren't providing it.

People who are much more talented and knowledgeable than me will likely figure out the best version of this. Think of Zer0 Grav1ty v0.1 as a starting point. If you like it, fork it, change it, run with it, or open an issue about what it *should* become.

Or better yet — start using it. Publish ZG stamps in your own articles. You'll be ahead of the curve, and your agents will thank you.

### Next directions

- **Embedding manifests.** The `embed` URL currently points to a single vector. Future versions could serve a manifest with vectors from all major embedding providers — OpenAI, Cohere, Voyage, etc. — so agents grab the one that matches their model.
- **Native HTML.** If stamps like this became a web standard, the format could collapse to two native concepts: `metaindex` (the semantic skeleton) and `metaembed` (the pre-computed vector). The stamp is the bootstrap — a format that works today, inside articles, without waiting for browser vendors.
- **Discovery.** A registry of ZG-stamped articles. A search engine that indexes meaning skeletons instead of page text.

The spec is open. The parser is free. The question at the center of this is simple: *what is the minimum representation of meaning?*

---

## Zer0 Grav1ty Stamp

Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://github.com/erikwillekens/habitualos/blob/main/apps/zer0gravity/src/spec/zg-0.1.md)
--zg:0.1
+ title: Zer0 Grav1ty — A Semantic Bootstrap for the Agentic Web
+ author: Erik Burns
+ theme: Articles should carry structured semantic abstracts so agents can parse meaning without processing full prose
+ index: [distillation beats compression; agents need structure not prose; meaning has bones]
+ embed: https://raw.githubusercontent.com/erikwillekens/habitualos/main/apps/zer0gravity/data/zer0-gravity-v01.embed.json
+ model: claude-sonnet-4-5
--/zg
