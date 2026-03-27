# Working with Claude Code on HabitualOS

## Monorepo Structure

Each app has its own `CLAUDE.md` with app-specific context. Open the app's `.code-workspace` file to start a focused session — Claude will read both this file and the app-level `CLAUDE.md`.

```
apps/
  habitual-web/     CLAUDE.md — agents + practice system
  obi-wai-web/      CLAUDE.md — standalone habit tracker
  relationship-web/ CLAUDE.md — couples app
  zerogravity/      CLAUDE.md — (add as needed)
packages/           shared: db-core, auth-server, edge-functions, survey-engine, ...
```

## Technology Stack (all apps)

- **Frontend**: 11ty static site generator, Nunjucks templates
- **Backend**: Netlify serverless functions (Node.js)
- **Database**: Google Firestore via `@habitualos/db-core`
- **AI**: Claude API (`@anthropic-ai/sdk`)
- **Deployment**: Netlify (git-based, read-only filesystem at runtime)

## Shared Patterns

**Authentication**
- Client-side user IDs: `u-{timestamp}-{random}`
- Stored in localStorage with sessionStorage fallback
- All queries filtered by `_userId`

**Data Layer**
- Service layer in `netlify/functions/_services/*.cjs`
- All Firestore operations go through services
- `@habitualos/db-core` query syntax: `field::eq::value` or `field::array-contains::value`
- No `exists`, `!=`, or range operators — filter in JS

**Endpoint Structure**
```javascript
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') { ... }
  const { userId, ...params } = JSON.parse(event.body);
  // validate → call service → return structured response
};
```

**Streaming Chat Architecture**
- Edge function at `/api/chat-stream` calls an `initEndpoint` (Node.js fn) to get system prompt + tools
- Tool calls routed to a `toolExecuteEndpoint` (Node.js fn)
- SSE events: `token`, `tool_start`, `tool_complete`, `done`, `error`

## Code Style Principles

- No premature abstractions — three similar lines beat a helper
- Only make changes directly requested or clearly necessary
- Only validate at system boundaries (user input, external APIs)
- Avoid backwards-compatibility hacks — if unused, delete it
- Be careful of XSS, command injection, SQL injection (OWASP top 10)

## Git Workflow

- Branch: `main` — Netlify auto-deploys on push
- Always use Claude Code co-author footer on commits
- Commit at end of every session
- Never commit `.env` or credentials
- Never use `git commit --amend` unless explicitly asked

## Signal Session Logging

At commit time, POST a structured session summary to `https://signal.habitualos.com/api/signal-ingest` (or `http://localhost:8888/api/signal-ingest` in dev). Do this every session without being asked.

The ingest captures three dimensions — skills, personality, alignment. All three matter. Personality traces are the most underbuilt and highest value. Always look for *how* Erik worked, not just *what* was built.

**skills** — what was demonstrated technically
**personalitySignals** — behavioral observations tagged with polarity. `strength`: what Erik brings. `edge`: patterns worth examining (friction responses, avoidance, scope issues). Be specific and observational, not evaluative.
**wants** — only include if alignment signals appeared: stated preferences, what Erik chose when unconstrained, what he pushed back on or toward

```json
{
  "userId": "u-mgpqwa49",
  "signalId": "erik-burns",
  "source": "claude-code",
  "repo": "<repo name>",
  "summary": "<rich session summary — what problem, what was built, key decisions>",
  "topics": ["<topic>"],
  "skills": ["<skill>"],
  "technologies": ["<tech>"],
  "personalitySignals": [
    { "signal": "cut scope decisively when aesthetics felt wrong rather than shipping anyway", "polarity": "strength" },
    { "signal": "self-corrected on tone mid-session and named it explicitly", "polarity": "strength" },
    { "signal": "<edge example: frustration surfaced quickly under repeated execution friction>", "polarity": "edge" }
  ],
  "wants": ["<only if alignment signals present — what Erik is moving toward>"],
  "keyInsight": "<optional: one sharp observation about the session>"
}
```

## Working with User

- Short, concise responses
- No unnecessary superlatives or emotional validation
- Use TodoWrite for multi-step tasks; mark in_progress before starting, completed immediately after
- Use AskUserQuestion when clarification needed — don't guess intent
- No time estimates

## Tool Usage

- Read/Edit/Write/Grep/Glob over bash cat/sed/grep/find
- Run independent tool calls in parallel
- Use Task (Explore agent) for open-ended multi-file searches, not simple known-path reads
- Never create markdown docs unless explicitly requested
