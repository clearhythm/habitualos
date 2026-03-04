# Zer0 Gr@vity — ZG v0.1 Microformat Specification

## Overview

ZG v0.1 defines a lightweight, agent-first semantic abstract format designed to:

- Represent the meaning skeleton of an article
- Enable consistent embedding for semantic linkage
- Support dual audiences (human + agent)
- Evolve organically through real-world use
- Remain encoder-agnostic

ZG is not a summary layer. It is a semantic contract.

---

## Design Principles

ZG v0.1 must be:

- Representational (not just descriptive)
- Compact and minimal
- Parseable via simple line extraction
- Human-intriguing (not YAML)
- Versioned
- Stable but evolvable

---

## Delimiters

Each ZG block is enclosed in unique markers for easy extraction:

⟪ZG·0.1⟫
...
⟫

Agents should extract everything between these markers.

---

## Field Model (v0.1)

Each field appears on a single line.

### Required Fields

- id: Stable article identifier (slug or UUID)
- t: Short title
- th: Thesis (one sentence)
- why: Why it matters (one sentence)
- mv: Main move (propose / critique / synthesize / report / design)
- cl: 3–7 core claims (inline list)
- use: What an agent or human should do with this

### Recommended Fields

- aud: Intended audience(s)
- tone: Affect + vibe (compact tags)
- stance: Epistemic posture (speculative / empirical / prescriptive / exploratory)
- nov: What is novel here (1–3 items)
- tags: Semantic anchors (not SEO keywords)
- rel: Adjacent ideas / schools / frameworks

### Optional Fields (Advanced Linkage)

- vals: Values orientation
- ctx: Context assumptions
- risk: Failure modes
- refs: References
- sig: Voice continuity marker

---

## Example ZG v0.1 Block

⟪ZG·0.1⟫ id:zero-gravity-01 t:Zer0 Gr@vity
mv:propose stance:exploratory tone:playful+technical aud:humans+agents
th:Agents need meaning-skeletons, not prose, to link ideas and act reliably.
why:Publishing an agent-abstract makes semantic indexing cheaper and clearer.
cl:[1 agents waste cycles on rhetorical glue; 2 meaning can be represented as claims+relations; 3 publish ZG blocks as a first-class layer; 4 embed ZG for linkage; 5 keep artistry in prose layer]
nov:[ZG microformat; distill→embed pipeline; two-audience publishing]
tags:[semantic-compression, agent-abstracts, meaning-skeleton, vector-linkage]
rel:[RAG, argument-mapping, schema-adjacent]
use:[index ZG; embed ZG; fetch prose only if needed; link by tags+claims]
⟫

---

## Representational Philosophy

ZG v0.1 captures:

- What the article is doing (mv)
- Its epistemic posture (stance)
- Its emotional texture (tone)
- Its central claim (th)
- Why it matters (why)
- Explicit propositions (cl)
- Novelty (nov)
- Semantic anchors (tags, rel)
- Intended use (use)

This enables:

- Semantic linkage
- Clustering
- Knowledge graph building
- Retrieval
- Cross-article synthesis

---

## Evolution Guidance

ZG v0.1 is intentionally minimal.

Potential future additions (only if usage demands it):

- q: Open research questions
- anti: What this is not claiming
- conf: Confidence estimate
- ask: Explicit calls-to-action

Do not expand the schema until real workflow pain appears.

ZG v0.1 is a proof-of-concept meaning skeleton.

