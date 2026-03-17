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

## Architecture Reference

See `docs/architecture.md` for the full reference: all 9 Firestore collections, all endpoints, streaming chat flow, RAG pipeline, and env vars.

## Key Patterns

See root `CLAUDE.md` for shared patterns (auth, data layer, endpoint structure).

## Local Dev

```
npm run start     # netlify dev
npm run eleventy:serve  # 11ty only (port 8081)
```
