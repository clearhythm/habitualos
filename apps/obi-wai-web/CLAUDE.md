# obi-wai-web — Claude Context

Standalone Netlify app. Single-user habit tracker: practice logging, Obi-Wai coaching chat, March 2026 daily challenge, SMS reminders via Twilio.

Stack: 11ty + Nunjucks, Netlify functions (Node.js), Netlify edge functions (Deno/TS), Firestore, Claude API, Twilio.

## Key Files

**Functions**
- `netlify/functions/practice-chat.js` — non-streaming coaching chat (fallback), includes tool use loop
- `netlify/functions/obi-wai-chat-init.js` — init endpoint for streaming chat (returns system prompt + tools)
- `netlify/functions/practice-tool-execute.js` — executes tool calls from edge function
- `netlify/functions/practice-submit.js` — log practice + generate AI wisdom
- `netlify/functions/challenge-status.js` — March 2026 daily challenge status
- `netlify/functions/sms-inbound.js` — Twilio webhook (practice logging + coaching via SMS)
- `netlify/functions/sms-reminder.js` — scheduled 7pm PT daily reminder (cron: `0 2 * * *`)
- `netlify/functions/sms-test.js` — test endpoint (types: inbound/reminder/send)
- `netlify/functions/user-profile-set.js` — save phone number to `profile.phoneNumber`
- `netlify/functions/users.js` — get user doc by docId
- `netlify/functions/_services/db-practice-logs.cjs` — practice log CRUD
- `netlify/functions/_services/db-user-profiles.cjs` — phone number upsert via `set + mergeFields`

**Edge Functions**
- `netlify/edge-functions/chat-stream.ts` — SSE streaming handler; calls initEndpoint then toolExecuteEndpoint
- `netlify/edge-functions/_lib/chat-stream-core.ts` — copied from `packages/edge-functions` at build time

**Pages**
- `src/practice/index.njk` — home (rank + stats)
- `src/practice/chat.njk` — Obi-Wai coaching chat UI (streaming first, non-streaming fallback)
- `src/challenge.njk` — `/challenge/` March calendar
- `src/profile.njk` — `/profile/` phone registration
- `src/sms-test.njk` — `/sms-test/` SMS test UI
- `src/_includes/nav.njk` — nav bar
- `src/_includes/base.njk` — base layout (favicon: fav.farm/🐉)

## Streaming Chat Architecture

```
Browser → POST /api/chat-stream (edge fn)
  → POST /api/obi-wai-chat-init   (gets system prompt + tools)
  → Claude API (streaming)
  → POST /api/practice-tool-execute  (per tool call)
  → SSE: token / tool_start / tool_complete / done / error
```

Non-streaming fallback: `/.netlify/functions/practice-chat` (has own tool loop, returns `toolsUsed[]`).

## Obi-Wai Tools

- `get_practice_history` — fetch logs with reflections, optional practice_name filter
- `get_practice_detail` — full history + definition for one practice

System prompt rule: upfront context is minimal preview only — call tools for any specific history question.

## Data Patterns

**Phone number**: stored at `users/{userId}/profile.phoneNumber` via `set + mergeFields` (true field-level upsert).
**Query by phone**: `profile.phoneNumber::eq::+1...` (dot notation works in db-core where clauses).
**Users with phones**: no `exists` operator — fetch all, filter in JS.

## March 2026 Challenge

- Daily goals: jogging (`/jog|run/i`) + LASSO (`/lasso|meditat/i`)
- Pacific time date grouping via `toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })`
- `challenge-status.js` returns: `completedDays`, `missedDays`, `streak`, `todayJogging`, `todayLasso`, `dayNumber`

## SMS / Twilio

- Inbound webhook: `/api/sms-inbound` — detects practice or falls back to Claude coaching
- Reminder: scheduled daily, skips if `todayComplete`; message varies by partial completion state
- Test endpoint: `/api/sms-test` protected by `SMS_TEST_SECRET`
- Signature validation skipped when `APP_ENV=local`

## Required Env Vars

```
ANTHROPIC_API_KEY
FIREBASE_ADMIN_CREDENTIALS   # JSON string
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER          # E.164 format
SMS_TEST_SECRET
RESEND_API_KEY               # (existing, not yet used)
```

## Local Development

```
pnpm --filter obi-wai-web run dev   # from monorepo root
# or from apps/obi-wai-web:
npm run dev
```

Restart dev server if 11ty templates cache stale content. Set `APP_ENV=local` in `.env` to skip Twilio signature validation.
