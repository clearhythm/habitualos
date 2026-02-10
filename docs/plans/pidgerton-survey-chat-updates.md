# Pidgerton Survey Chat — Remaining Steps

## What's Built (Committed)

All code is implemented across 6 commits (`2bb0c4e` through `e87e6d1`):

### Shared Package: `packages/survey-engine/`
- `survey-definitions.cjs` — CRUD for survey definitions
- `survey-responses.cjs` — CRUD for responses, sorts by `_createdAt`
- `survey-actions.cjs` — CRUD for weekly actions, `completedBy` tracking
- `survey-focus.cjs` — Precomputed focus dimensions, `recalculateFocus()`
- `focus-algorithm.cjs` — Pure function: 3 lowest + 2 highest combined % scores
- `index.cjs` — Public API (13 exports)

### Seed Scripts (already run against Firestore)
- `scripts/seed-survey-definition.js` — 10 dimensions, 28 real questions, 0-4 scale
- `scripts/seed-survey-responses.js` — Erik + Marta's real scores from Google Forms CSV, with `score` (percentage) field, cleanup-on-rerun

### Chat Integration
- `apps/relationship-web/netlify/functions/rely-chat-init.js` — Agent modes: checks for open survey action, injects SURVEY CHECK-IN MODE prompt section with 0-10 verbal scale
- `apps/relationship-web/netlify/edge-functions/chat-stream.ts` — Added `STORE_MEASUREMENT` signal pattern
- `apps/relationship-web/src/chat.njk` — Survey confirmation modal showing percentage bars, confirm/dismiss handlers, signal text stripping
- `apps/relationship-web/netlify/functions/survey-measurement-save.js` — Saves weekly response (normalizes 0-10 to %), marks user completed in action

### Weekly Automation
- `apps/relationship-web/netlify/functions/survey-weekly-create.js` — Scheduled function (Monday 9am PT), idempotent, queries users table for emails
- `apps/relationship-web/netlify/functions/_services/email.cjs` — Resend integration, HTML + text template
- `apps/relationship-web/netlify.toml` — Schedule config added

### Infrastructure
- `packages/db-core/db-core.cjs` — `create()` now respects caller-provided `_createdAt`

## Data in Firestore (seeded)
- `survey-definitions/survey-rel-v1` — Master survey with 0-4 scale metadata
- `survey-responses/sr-...` — 2 full responses (Erik + Marta) with `score` (%) field
- `survey-focus/survey-rel-v1` — 5 focus dimensions:
  - **Lowest 3:** Financial Management (25%), Physical & Sexual Intimacy (29%), Conflict Resolution (29%)
  - **Highest 2:** Division of Labor (63%), Individual Autonomy (63%)

## Remaining Steps

### 1. Set Environment Variables (Netlify Dashboard)

Three env vars needed for `relationship-web`:

| Variable | Value | Used By |
|----------|-------|---------|
| `RESEND_API_KEY` | API key from Resend dashboard | `email.cjs` |
| `RESEND_FROM_EMAIL` | e.g. `Pidgerton <pidgerton@bloomlearning.us>` | `email.cjs` |
| `PIDGERTON_URL` | e.g. `https://pidgerton.netlify.app` (or custom domain) | `email.cjs` (CTA link) |

**Note:** Resend domain (`bloomlearning.us`) must be verified in Resend first. The `RESEND_FROM_EMAIL` format should be `Display Name <address@domain>`.

### 2. Push to Deploy

```bash
git push origin main
```

This triggers a Netlify build. All new functions and edge function changes deploy automatically.

### 3. Create First Survey Action (Manual Trigger)

The weekly cron runs Mondays at 9am PT. To test before then, trigger manually:

```bash
# From Netlify CLI
netlify functions:invoke survey-weekly-create --no-identity

# Or via curl against the deployed function
curl -X POST https://pidgerton.netlify.app/.netlify/functions/survey-weekly-create
```

This creates an open `survey-actions` document with the 5 focus dimensions. Once it exists, the next time either user opens Pidgerton chat, the agent will offer the check-in.

### 4. End-to-End Test

1. Open Pidgerton chat (with an open survey action in DB)
2. Verify the agent mentions the check-in is available
3. Engage with the survey — agent should ask about dimensions 1-2 at a time on 0-10 scale
4. After confirming scores, verify the `STORE_MEASUREMENT` signal fires
5. Verify the confirmation modal shows dimensions with percentage bars
6. Click "Save" — verify response saved to `survey-responses` and user marked in `survey-actions`
7. Have the other user complete it — verify action state changes to `completed` when both finish

### 5. Verify Email (Optional — Can Test Separately)

After env vars are set and domain is verified:
- Trigger `survey-weekly-create` manually
- Check both users' inboxes for the notification email
- Verify the CTA link goes to the correct chat URL

## Architecture Notes for Context Rebuild

### Scale System
- **Monthly form (Google Forms):** 0-4 Likert → normalized to % via `score = (average / 4) * 100`
- **Weekly verbal (chat agent):** 0-10 → normalized to % via `score = (rating / 10) * 100`
- **Canonical unit:** Percentage (0-100%). All comparison, display, and focus calculation uses `score` (%)

### Agent Modes Pattern
`rely-chat-init.js` checks for pending survey actions and injects a structured "SURVEY CHECK-IN MODE" prompt section. The agent doesn't literally switch modes at an API level — it's all prompt-driven. The frontend receives `availableModes` to know which signals to handle.

### Signal Flow
1. Agent collects scores conversationally (0-10)
2. Agent emits `STORE_MEASUREMENT` signal with JSON payload
3. `chat-stream-core.ts` parses signal, returns it to frontend
4. Frontend shows confirmation modal with percentage bars
5. On confirm → `POST /api/survey-measurement-save` normalizes and saves
6. On dismiss → scores discarded

### Key Files
- Agent prompt: `apps/relationship-web/netlify/functions/rely-chat-init.js` (~line 141)
- Signal handling: `apps/relationship-web/src/chat.njk` (handleSurveySignal function)
- Save endpoint: `apps/relationship-web/netlify/functions/survey-measurement-save.js`
- Focus algorithm: `packages/survey-engine/focus-algorithm.cjs`
- Email template: `apps/relationship-web/netlify/functions/_services/email.cjs`
