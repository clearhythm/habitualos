# Result: Score Coach Loop — Interview → Rewrite → Rescore

## What was built

Eight files created or modified across backend, edge function, and frontend layers.

### Backend (Netlify Functions)

**`netlify/functions/_services/db-signal-guest-evals.cjs`**
Added `getGuestEvalById(gevalId)` and `updateGuestEval(gevalId, data)`. Both use the Firestore `signal-guest-evals` collection; `updateGuestEval` uses `set+merge:true`.

**`netlify/functions/signal-guest-coach-init.js`** (NEW)
Init endpoint called by chat-stream for `signal-guest-coach` chatType. Fetches geval from Firestore, validates `_guestId === guestId`, reconstructs `distilledJd` from stored `jdSummary`, filters and severity-sorts closeable gaps, returns `systemMessages` (conversation seed with coach prompt + opener as user/assistant pair), `tools` (finish_interview), and `opener` string.

**`netlify/functions/signal-guest-coach-execute.js`** (NEW)
Tool execute endpoint for `finish_interview`. Validates guestId/gevalId, saves `coachingImprovements` array to geval doc, returns `{ result: { ok: true } }`.

**`netlify/functions/signal-guest-improve.js`** (NEW)
POST `/api/signal-guest-improve`. Fetches geval + coachingImprovements, runs Sonnet rewrite, then Sonnet rescore. If score didn't improve, retries once with a harder prompt. Stores `improvedResumeText`, `rewrittenSections`, `improvedScore`, `improvementAttempts` on geval doc. Returns result with `improved` boolean and `reason` if no improvement.

### Edge Function

**`netlify/edge-functions/chat-stream.ts`**
Added `signal-guest-coach` chatType pointing to `/api/signal-guest-coach-init` and `/api/signal-guest-coach-execute`.

**`netlify/edge-functions/_lib/chat-stream-core.ts`**
Three changes:
1. Added `g-` prefix to allowed userId values (guest IDs)
2. Extracted `gevalId` from request body; passes `{ userId, gevalId, guestId: userId }` to init and `{ gevalId, guestId }` to tool execute for `signal-guest-coach` chatType
3. Detects conversation-seed `systemMessages` (role/content pairs) vs system prompt blocks (type/text). If seed: prepends to messages array with no system prompt (correct pattern for coach chat). Existing chat types unaffected.

### Frontend

**`src/score.njk`**
Redesigned for 6 states. Removed `#score-jd-title` field. Updated hero copy. Added:
- `#score-coach-btn` ("Improve my score →") to result state
- `#score-coach` — full-height chat section with header, messages div, sticky input bar
- `#score-building` — centered loading screen with spinner
- `#score-improved-wrap` — improved result wrap (score delta badge + rewrite cards + upsell)

**`src/assets/js/score.js`**
Removed title field. Added:
- `updateSavedEval(gevalId, patch)` — patches localStorage entry
- `showResult` now checks for closeable gaps to conditionally show `#score-coach-btn`, also hides coach/building/improved states when returning to result
- `readStream(res, handlers)` — SSE parser copied from signal-widget.js (with `onToolStart` added)
- `startCoachChat(evalData)` — shows chat state, renders opener, resets history
- `sendChatMessage()` — streams to `/api/signal-chat-stream`, handles `onToolStart('finish_interview')` → shows building screen, `onToolComplete('finish_interview')` → calls `handleImprove()`
- `handleImprove(gevalId)` — POSTs to `/api/signal-guest-improve`
- `renderImproved(gevalId, result)` — renders delta badge + rewrite cards, updates localStorage, shows `#score-improved-wrap`
- Init: if most recent eval has `improvedScore`, renders improved state directly on load

**`src/styles/_score.scss`**
Added styles for: `.score-coach-btn`, `.score-coach`, `.score-coach-header`, `.score-coach-back`, `.score-coach-messages`, `.score-coach-input-wrap`, `.score-coach-textarea`, `.score-coach-send`, `.msg` / `.msg--user` / `.msg--assistant`, `.score-building` + spinner + `@keyframes spin`, `.score-delta-badge` + sub-elements, `.score-rewrite-card` + columns, `.score-no-improve-msg`. All use SCSS variables, no hardcoded colors.

---

## Needs manual review before shipping

1. **`chat-stream-core.ts` conversation seed detection** — detection is based on whether `systemMessages[0].role` is a string. If any existing chat type ever returned objects with a `role` field in their systemMessages, they'd be incorrectly treated as conversation seeds. Verify no existing init endpoint does this. (Currently none do — all use `{ type, text }` blocks — but worth confirming.)

2. **`score-again` flow with improved state** — after viewing an improved result, clicking "Score another role" currently navigates back to the form via the history strip / result state. The improved-wrap is hidden by `showResult`, but there's no explicit "reset to form" button on the improved state. If needed, add a "Start over" button to `#score-improved-wrap`.

3. **Opener in chatHistory** — the client sends `chatHistory: []` on the first turn, and the server seeds the conversation with `[user: coachPrompt, assistant: opener]`. The client chatHistory accumulates from the first user message onward. This is intentional, but means if the user refreshes mid-conversation, the session is lost (expected for guest mode).

4. **`signal-guest-improve.js` timeout risk** — rewrite + rescore can run up to ~50–60s in the retry case. Netlify background functions have a 15-minute limit, but regular functions time out at 26s. This endpoint must be configured as a background function in `netlify.toml`, or you'll see 502s on retries. Check `netlify.toml` for `[functions."signal-guest-improve"]` config.

5. **No loading indicator while streaming chat** — the assistant message div is added immediately and updated token-by-token, but there's no typing indicator or visual feedback between Send click and first token. Low priority but worth a future pass.

6. **`score.njk` upsell visibility** — `#score-upsell` is shown (`hidden = false`) inside `showResult`, but the markup starts with `hidden`. Verify it shows correctly on first render after scoring.
