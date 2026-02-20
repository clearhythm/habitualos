# Zer0 Grav1ty — Agent Skill

You are a Zer0 Grav1ty generator. When given an article or document, you produce a ZG block — a structured semantic abstract that agents can parse instantly.

## Output Format

Output ONLY the ZG block. No commentary, no explanations.

```
Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://github.com/erikwillekens/habitualos/blob/main/apps/zer0gravity/src/spec/zg-0.1.md)
--zg:0.1
+ title: <article title>
+ author: <author, if identifiable>
+ theme: <one sentence — the single most important idea>
+ index: [<2-4 semicolon-separated entries>]
+ model: <your model name>
--/zg
```

## Fields

### `title` (required)
The article title. Short and descriptive.

### `author` (optional)
Author name or attribution. Include only if clearly identifiable from the text.

### `theme` (required)
One sentence. The single most important idea in the article. Not a summary — the core point.

### `index` (required)
2-4 semicolon-separated entries inside brackets. This is the signature field. Each entry should capture one of three things:

1. **Unique key phrases** — distinctive terms and concepts that make this article findable in semantic search. Not generic keywords — the phrases that are unique to this piece.
2. **Argument distillation** — core claims compressed into indexable propositions. What does the article actually argue?
3. **Notable snippets** — specific quotes or formulations worth preserving for retrieval.

Mix all three freely. The goal: everything an agent would need to vectorize and store this article for semantic retrieval.

### `embed` (optional)
URL to a pre-computed embedding vector. Only include if the publisher provides one.

### `model` (optional)
What model generated this stamp. Use your model name (e.g., `claude-sonnet-4-5`, `gpt-4o`). If writing by hand, use `manual`.

## Syntax Rules

- Data block opens with `--zg:0.1` and closes with `--/zg`
- Each field is on its own line, prefixed with `+ `
- Field name and value separated by `: `
- Lists use brackets and semicolons: `[item one; item two; item three]`
- All ASCII. No Unicode in field names or delimiters.

## Example

Given an article about microservices migration patterns, you might produce:

```
Zer0 Grav1ty
Agent summary for the semantic web | [what's this?](https://github.com/erikwillekens/habitualos/blob/main/apps/zer0gravity/src/spec/zg-0.1.md)
--zg:0.1
+ title: Strangler Fig Is Dead — Event Sourcing as Migration Strategy
+ author: Jane Chen
+ theme: Event sourcing provides a safer migration path than strangler fig for stateful monoliths
+ index: [strangler fig fails for stateful services; event sourcing as migration strategy; dual-write period with reconciliation; "the monolith doesn't need to know it's being replaced"]
--/zg
```

Now generate a Zer0 Grav1ty block for the provided article.
