# Signal — Architecture Reference

Full reference for the Signal app. Read this before exploring the codebase.

## Product Vision

Signal is a professional profile that builds itself from your actual AI-assisted work — and lets anyone honestly evaluate fit against it.

**The core problem it solves:** Developers doing serious AI-assisted work have a rich, real history of what they've built, decided, and shipped. That history lives in Claude Code sessions, commit messages, architectural decisions, and tradeoffs navigated. None of it is legible to evaluators. GitHub shows what you built, not how you think. Resumes are self-reported. LinkedIn is noise.

**What Signal does instead:**
- Captures session context automatically as you work in Claude Code (via CLAUDE.md instruction + git hook)
- Synthesizes that history into a structured, evidence-grounded profile (skills, wants, personality)
- Lets anyone — a recruiter, a founder, a potential collaborator — paste a job description and get an immediate, honest fit score
- Embeds as a widget on your own site so evaluation happens where you already exist

**Who it's for:** Developers doing real AI-assisted work. Not a general professional network. The profile can't be faked because it's grounded in what you actually built.

**Primary use cases:**
1. Owner pastes a JD → gets honest fit score before deciding whether to apply
2. Visitor (recruiter, founder) pastes a JD → sees fit score against the owner's real profile
3. Widget on owner's site surfaces both use cases in one embedded experience

**What it is not:** A chatbot that talks about you. Conversation is optional and additive. The primary interface is JD in → structured score out.

## Profile Feed Architecture

Signal profiles are built from three complementary sources:

### 1. Claude Code session summaries (primary — rich context)
At commit time, Claude Code generates a structured session summary covering: what problem was being solved, what was designed or decided, technologies used, tradeoffs made. Posted to `/api/signal-ingest`. Triggered by CLAUDE.md instruction — runs every time a commit is made in a Claude Code session.

### 2. Git post-commit hook (automatic — lightweight)
A standard `.git/hooks/post-commit` script sends commit hash, message, and metadata to `/api/signal-ingest` as a fallback. Less rich than a session summary but requires no memory or intent. Catches commits made outside Claude Code sessions.

### 3. Manual conversation exports (supplementary)
Claude.ai and ChatGPT both export conversation history as JSON. The existing upload pipeline (`signal-context-upload` → `signal-context-process`) handles these. Useful for bootstrapping or one-time historical imports. Not the primary ongoing feed.

### Weekly synthesis
A scheduled function aggregates all new chunks into updated `skillsProfile`, `wantsProfile`, `personalityProfile` on the owner doc. Profiles improve automatically as more sessions are captured.

## Overview

Signal is a matchmaking concierge widget. A signal owner's profile is built automatically from their Claude Code work history. Visitors — recruiters, founders, collaborators — can paste a job description and immediately get a structured fit score against that profile. The owner can also evaluate opportunities themselves and generate targeted resumes/cover letters.

---

## Firestore Collections

All collections are prefixed `signal-` and isolated from the rest of the HabitualOS monorepo.

| Collection | Key | Purpose |
|---|---|---|
| `signal-owners` | `{signalId}` | Profile: displayName, personas, encrypted API key, synthesized profiles, contextStats |
| `signal-context-chunks` | `{signalId}-{conversationId}` | Processed work history chunks — the RAG source |
| `signal-auth-codes` | `{normalizedEmail}` | Email verification codes (15-min TTL) |
| `signal-chats` | `sc-{timestamp}-{random}` | Chat session logs |
| `signal-leads` | `{signalId}-{visitorId}` | Visitors who triggered a high-confidence next step |
| `signal-waitlist` | `{normalizedEmail}` | Waitlist signups |
| `signal-evaluations` | `eval-{timestamp}-{random}` | Opportunity fit evaluations (skills/alignment scores, gaps, recommendation) |
| `signal-resumes` | `resume-{timestamp}-{random}` | Generated resumes grounded in chunk evidence |
| `signal-covers` | `cover-{timestamp}-{random}` | Generated cover letters toned to owner's communicationStyle |

### signal-owners schema
```
signalId, userId, email, displayName, status ('pending'|'active')
personas: [{ key, label, opener }]  // up to 4
contextText: string  // freeform context
anthropicApiKey: string  // AES-256-GCM encrypted
skillsProfile: { coreSkills[], technologies[], domains[], projectTypes[], completeness% }
wantsProfile: { workTypes[], opportunities[], excitedBy[], workStyle, notLookingFor[], rawWants[], completeness% }
personalityProfile: { communicationStyle, intellectualStyle, problemApproach, completeness% }
conceptGraph: { nodes[], edges[] }
contextStats: { total, processed, pending, bySource }
```

### signal-context-chunks schema
```
signalId, conversationId (dedup key), source ('claude'|'chatgpt')
title, date, messageCount, excerpt
status: 'pending'|'processed'|'error'
// Extracted by Claude haiku:
topics[], skills[], technologies[], projects[], wants[]
personalitySignals[], concepts[], summary, keyInsight
dimensionCoverage: { skills, wants, personality }
evidenceStrength: 1–10
```

---

## Endpoints

### Auth
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-register` | `signal-register.js` | Create owner + send verification email |
| `POST /api/signal-auth-verify` | `signal-auth-verify.js` | Verify code → activate owner |

### Config
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-config-get` | `signal-config-get.js` | Get owner config (omits encrypted key) |
| `POST /api/signal-config-set` | `signal-config-set.js` | Update displayName, personas, contextText, API key |

### Context (RAG Pipeline)
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-context-upload` | `signal-context-upload.js` | Upload conversation export → create pending chunks (deduped) |
| `POST /api/signal-context-status` | `signal-context-status.js` | Get contextStats + synthesized profiles |
| `POST /api/signal-context-process` | `signal-context-process.js` | Process N pending chunks via Claude haiku extraction |
| `POST /api/signal-context-synthesize` | `signal-context-synthesize.js` | Aggregate processed chunks → build skillsProfile/wantsProfile/personalityProfile |
| `POST /api/signal-context-delete` | `signal-context-delete.js` | Delete all chunks + reset profiles |

### Chat (Matchmaking Concierge)
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-chat-init` | `signal-chat-init.js` | Returns system prompt, tools, opener for a chat session |
| `GET/SSE /api/signal-chat-stream` | edge: `chat-stream.ts` | Streaming chat via SSE (calls init + tool-execute) |
| `POST /api/signal-tool-execute` | `signal-tool-execute.js` | Handles `search_work_history` RAG tool call |
| `POST /api/signal-chat-save` | `signal-chat-save.js` | Persist chat session to `signal-chats` |

### Evaluation & Generation
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-evaluate` | `signal-evaluate.js` | Score opportunity fit via Claude sonnet |
| `POST /api/signal-evaluations-get` | `signal-evaluations-get.js` | List last 20 evaluations for owner |
| `POST /api/signal-resume-generate` | `signal-resume-generate.js` | Generate evidence-grounded resume for an evaluation |
| `POST /api/signal-cover-generate` | `signal-cover-generate.js` | Generate tone-matched cover letter |

### Leads & Waitlist
| Endpoint | Function | Description |
|---|---|---|
| `POST /api/signal-lead-save` | `signal-lead-save.js` | Save visitor lead (triggered client-side at confidence ≥ 0.65) |
| `POST /api/signal-leads-get` | `signal-leads-get.js` | List last 50 leads for owner |
| `POST /api/signal-waitlist` | `signal-waitlist.js` | Add email to waitlist |

---

## Streaming Chat Architecture

```
Host page (embed.js or widget.njk)
  → GET /api/signal-chat-stream  (SSE, edge function)
       ↓
  chat-stream.ts (Deno edge function)
       → POST /api/signal-chat-init   (get system prompt + tools)
       → Anthropic API (streaming)
       → tool call: POST /api/signal-tool-execute  (search_work_history)
       → SSE events: token | tool_start | tool_complete | done | error
```

SSE events consumed by `signal-widget.js`:
- `token` — append to current AI message
- `tool_start` / `tool_complete` — show/hide thinking indicator
- `FIT_SCORE_UPDATE` — update ring + dimension bars
- `done` — finalize message, check lead save threshold
- `error` — display error state

---

## RAG Pipeline

1. **Upload** (`signal-context-upload`) — user pastes JSON export from Claude or ChatGPT. Each conversation → one pending chunk. Deduped by `conversationId`.

2. **Process** (`signal-context-process`) — called repeatedly (limit 1–5 chunks per call). For each pending chunk, Claude haiku extracts: topics, skills, technologies, projects, wants, personalitySignals, concepts, summary, keyInsight, evidenceStrength, dimensionCoverage.

3. **Synthesize** (`signal-context-synthesize`) — aggregates all processed chunks into three profiles (skillsProfile, wantsProfile, personalityProfile) + a conceptGraph. Pure JS, no Claude call.

4. **Search** (`searchChunks` in `db-signal-context.cjs`) — mid-conversation RAG. Called by `signal-tool-execute.js` when Claude uses the `search_work_history` tool. Tokenizes query, scores chunks by term overlap × evidenceStrength, returns top N.

---

## Service Files

| File | Purpose |
|---|---|
| `netlify/functions/_services/db-signal-owners.cjs` | CRUD for signal-owners |
| `netlify/functions/_services/db-signal-context.cjs` | CRUD + searchChunks for signal-context-chunks |
| `netlify/functions/_services/crypto.cjs` | AES-256-GCM encrypt/decrypt for API keys |
| `netlify/functions/_services/email.cjs` | Resend email: verification code + welcome |

---

## Auth Patterns

**Owner auth:** Email verification code (15-min TTL). On verify, `signal-owners.status` → `'active'`. All owner endpoints call `getOwnerByUserId(userId)` and check `owner.status === 'active'`.

**Visitor (embed) auth:** No auth. `signalId` passed directly → `getOwnerBySignalId(signalId)`. Visitor gets anonymous `v-{timestamp}-{random}` userId stored in host domain's localStorage.

**Owner in embed (owner mode):** `/signin` command in chat triggers inline email auth flow. Session stored as `{ userId, signalId, authedAt }` in host localStorage with 30-day TTL. Sensitive operations (context export, API key change) require re-auth each time.

---

## Env Vars

| Var | Required | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | context-process, evaluate, resume-generate, cover-generate, edge function |
| `FIREBASE_ADMIN_CREDENTIALS` | Yes | db-core (all Firestore access) |
| `ENCRYPTION_KEY` | Yes | crypto.cjs (64 hex chars = 32 bytes) |
| `RESEND_API_KEY` | Yes | email.cjs |
| `RESEND_FROM_EMAIL` | No | email.cjs (default: `Signal <noreply@signal.habitualos.com>`) |
