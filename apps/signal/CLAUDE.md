# signal — Claude Context

Standalone Netlify app in the HabitualOS monorepo.

## Quick Start

1. Read root `CLAUDE.md` (monorepo conventions)
2. This app uses 11ty + Nunjucks, Netlify Functions, Firestore, Claude API

## Stack

- Frontend: 11ty, Nunjucks, SCSS
- Backend: Netlify serverless functions (Node.js)
- Database: Firestore via `@habitualos/db-core`
- AI: Claude API via `@anthropic-ai/sdk`
- Auth: `@habitualos/auth-server`

## Design Philosophy & Standing Directive

Signal's purpose is human potentiation — understanding what the behavioral record of someone's work reveals about who they are. Hiring is the current context, not the ceiling.

**Three dimensions. Always.**
When touching `signal-ingest.js`, profile synthesis, chat tool definitions, eval scoring, or RAG context:
- **Skills** — what was done (easiest to extract, already working)
- **Personality** — *how* someone worked: friction responses, scope decisions, self-correction, aesthetic judgment (most underbuilt, highest value)
- **Alignment** — what someone is moving toward (sparse in work sessions, rich in conversation)

**The prompt IS the data.** How Erik works with AI is behavioral signal, not just task log. The ingest should capture the *person*, not just the *project*.

**When building anything that touches the profile or synthesis layer**, ask: does this code capture how someone worked, not just what they built? If personality traces are being lost or ignored, that's a design failure worth flagging.

**The experience layer is the person, not the agent.** The chat interface should feel like talking TO the candidate — first person, voiced by the behavioral record. The agent is an instrument they wield, not a separate voice. The fit score is delivered by the person ("my Signal score for this role is 84 — here's what drove it"), not by a black box. This makes the score more credible, the conversation more direct, and the product genuinely differentiated. A candidate who can say "here's where I'd struggle in this role, and here's the evidence" is rare. Signal makes that possible.

See `docs/design.md` for the full framework.

## Architecture Reference

See `docs/architecture.md` for the full reference: all 9 Firestore collections, all endpoints, streaming chat flow, RAG pipeline, and env vars.

## Key Patterns

See root `CLAUDE.md` for shared patterns (auth, data layer, endpoint structure).

## Deploying to Production

This site uses **deploy lock** — Netlify auto-publishing is disabled. To deploy:

```
npm run ship   # unlocks, promotes latest build to production, re-locks
```

When Erik says "ship it", run `npm run ship`. Do not push and assume it will deploy.

## Local Dev

```
npm run start     # netlify dev
npm run eleventy:serve  # 11ty only (port 8081)
```

## Testing

Tests live in `tests/`. Run against a local dev server (`npm run start`):

```
node tests/api.test.js                           # localhost:8888
SIGNAL_USER_ID=u-xxx node tests/api.test.js      # include owner-auth tests
node tests/api.test.js https://signal.habitualos.com  # run against prod
```

**When to run:** after any endpoint change, field rename, or schema update.
**Keep up to date:** when adding endpoints or changing request/response shapes, update `tests/api.test.js`.

**Firestore migration** (one-time, run after field renames):
```
node tests/migrate-fields.cjs --dry-run   # preview changes
node tests/migrate-fields.cjs             # apply
```
