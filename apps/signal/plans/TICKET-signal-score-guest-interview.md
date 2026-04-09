# TICKET: Score Coach Loop — Interview → Rewrite → Rescore

## Why this exists

The `/score/` page produces a fit score but doesn't help the candidate do anything with it. The real value is the coaching loop: AI interviews the candidate to unearth experience their resume doesn't show, rewrites the relevant sections, rescores, and shows the delta. This is the authentic "I used it, it helped me" story — not a static report.

---

## User Flow (mobile-first, 6 focused states)

Each state is one thing. No scrolling walls.

1. **Form** — Resume textarea + JD textarea + submit. No separate title field (extracted from JD distillation).
2. **Scoring...** — "Analyzing your fit…"
3. **Score result** — Score card + recommendation + summary. One CTA: "Improve my score →" (only shown when closeable gaps exist). Upsell below.
4. **Chat** — Full-screen coaching conversation. AI drives. Input pinned at bottom.
5. **Building...** — "Rewriting your resume…" transition screen.
6. **Result** — Score delta ("6 → 8"), before/after resume sections, upsell.

---

## Architecture

Reuses the existing `chat-stream` edge function by adding a new chatType: `signal-guest-coach`.

**Chat request body:**
```js
{ chatType: 'signal-guest-coach', guestId, gevalId, message, chatHistory }
```

**Why the rewrite is a separate call (not inside the edge function):**
Edge functions have a 30s timeout. Rewrite + rescore ≈ 40s. The chat stream runs fast; when the AI calls `finish_interview`, the client transitions to "Building..." and makes a separate POST to `/api/signal-guest-improve` (regular function, no timeout concern).

---

## Coaching System Prompt (`signal-guest-coach-init.js`)

```
You are a resume coach. You've already scored this person's resume against a job.
Your job: through conversation, unearth the real experience they have that their resume doesn't show.

Rules:
- Ask ONE question at a time. No lists, no preambles.
- Start with the highest-severity closeable gap.
- When someone gives a vague answer, push for specifics: scope, numbers, outcomes, timeline.
- Be direct. Human. Not corporate.
- When you have enough concrete material to meaningfully improve the resume (2-4 solid points per closeable gap), call finish_interview().
- If after 3 exchanges a gap is going nowhere, move on.
- Don't explain what you're doing. Just ask.

== THEIR RESUME ==
${resumeText}

== JOB REQUIREMENTS ==
${distilledJd}

== CLOSEABLE GAPS (address these, highest severity first) ==
${closeable gaps with index, dimension, severity, gap text}
```

**Tool:** `finish_interview({ improvements: [{ gapIndex, learnedInfo }] })`

**Opener** (shown before first user message):
`"I've looked at your resume against the role. I'm going to ask you a few targeted questions — answer as specifically as you can. Let's start."`

---

## Rewrite + Rescore (`signal-guest-improve.js`)

**Step 1 — Rewrite (Sonnet):**
```
You are improving a candidate's resume for a specific job based on what they told you.

== ORIGINAL RESUME ==
${resumeText}

== JOB REQUIREMENTS ==
${distilledJd}

== WHAT YOU LEARNED ==
${improvements from finish_interview}

Rewrite the relevant resume sections. Keep their voice. Only use what they told you.
Be specific — numbers, outcomes, scope.

Return ONLY valid JSON:
{
  "rewrittenSections": [{ "gapIndex": 0, "original": "...", "rewritten": "...", "note": "..." }],
  "improvedResumeText": "full resume with sections replaced"
}
```

**Step 2 — Rescore:** Run existing scoring prompt against `improvedResumeText` + same `distilledJd`.

**Step 3 — If score didn't improve:** Retry once with a harder push prompt. If still no improvement, return `{ improved: false, reason: "..." }` explaining what's missing.

**Max 2 attempts.** Store best result on geval doc: `improvedResumeText`, `rewrittenSections`, `improvedScore`, `improvementAttempts`.

---

## Implementation Notes (read before writing any code)

### Files to read first
Before modifying or creating anything, read these files in full:
- `netlify/edge-functions/chat-stream.ts` — understand the existing chatType config structure before adding `signal-guest-coach`
- `netlify/functions/signal-tool-execute.js` — understand the tool execute endpoint request/response interface before writing `signal-guest-coach-execute.js`
- `netlify/functions/signal-visitor-init.js` — understand the exact return shape expected by chat-stream-core (systemMessages, tools, opener)
- `netlify/functions/signal-guest-score.js` — for CORS headers pattern and distilledJd reconstruction code
- `src/assets/js/score.js` — read the full existing file before modifying it
- `src/score.njk` — read current markup before rewriting
- `src/styles/_score.scss` — read existing styles before adding new ones
- `netlify/functions/_services/db-signal-guest-evals.cjs` — read before adding functions

### score.js uses ES modules
`src/assets/js/score.js` is loaded with `type="module"` (see `src/_includes/base.njk`). Use `import { apiUrl } from './api.js'` for API calls, same as `register.js` and `dashboard.js`.

The `readStream` SSE parser needs to be copied from `src/assets/js/signal-widget.js` (lines ~1318–1354) as a local function — the widget is a separate IIFE bundle and cannot be imported from.

### CORS headers (all new endpoints)
Copy exactly from `signal-guest-score.js`:
```js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
// Always handle OPTIONS:
if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
```

### distilledJd reconstruction (copy this exactly)
Used in both `signal-guest-coach-init.js` and `signal-guest-improve.js`:
```js
function buildDistilledJd(jdSummary) {
  return [
    `Role: ${jdSummary.roleTitle} (${jdSummary.level || 'unspecified level'})`,
    jdSummary.responsibilities?.length ? `Responsibilities:\n${jdSummary.responsibilities.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.mustHave?.length ? `Must have:\n${jdSummary.mustHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.niceToHave?.length ? `Nice to have:\n${jdSummary.niceToHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.cultureSignals?.length ? `Culture signals:\n${jdSummary.cultureSignals.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.compensation ? `Compensation: ${jdSummary.compensation}` : '',
    jdSummary.workModel ? `Work model: ${jdSummary.workModel}` : '',
  ].filter(Boolean).join('\n\n');
}
```

### `finish_interview` tool definition (full JSON schema for Anthropic API)
```js
const FINISH_INTERVIEW_TOOL = {
  name: 'finish_interview',
  description: 'Call this when you have gathered enough concrete, specific information to meaningfully improve the candidate\'s resume for each closeable gap. Do not call prematurely — you need specific outcomes, numbers, or scope for each gap addressed.',
  input_schema: {
    type: 'object',
    properties: {
      improvements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gapIndex: { type: 'number', description: 'Index of the gap from the closeable gaps list' },
            learnedInfo: { type: 'string', description: 'Concrete information learned from conversation for this gap' },
          },
          required: ['gapIndex', 'learnedInfo'],
        },
      },
    },
    required: ['improvements'],
  },
};
```

### Opener display pattern
The init function returns an `opener` string. The client renders this as the first assistant message in the chat UI WITHOUT making a streaming API call. When the user sends their first message, chat-stream is called with `chatHistory: [{ role: 'assistant', content: opener }]` — this tells the AI what it already said so it can continue naturally. Subsequent turns append to chatHistory normally.

`signal-guest-coach-init.js` return shape (match this exactly):
```js
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    success: true,
    opener: "I've looked at your resume against the role. I'm going to ask you a few targeted questions — answer as specifically as you can. Let's start.",
    systemMessages: [
      { role: 'user', content: COACH_PROMPT(resumeText, distilledJd, closeableGaps) },
      { role: 'assistant', content: "I've looked at your resume against the role. I'm going to ask you a few targeted questions — answer as specifically as you can. Let's start." },
    ],
    tools: [FINISH_INTERVIEW_TOOL],
  }),
};
```

### Tool execute endpoint interface
`signal-guest-coach-execute.js` receives from chat-stream-core:
```js
// Request body:
const { guestId, gevalId, toolUse } = JSON.parse(event.body);
const { name, input } = toolUse; // name === 'finish_interview', input === { improvements: [...] }

// Response must be:
{ statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ result: { ok: true } }) }
```

### SCSS variables
Use variables from `src/styles/_variables.scss`. Key ones: `$color-primary` (#7c3aed), `$color-bg` (#0f172a), `$color-text` (#f9fafb), `$color-text-muted` (#9ca3af), `$color-border` (#334155). Do not hardcode these values.

### Mobile input keyboard handling
On the `.score-coach-input-wrap`, use `position: sticky; bottom: 0` rather than `position: fixed` to avoid iOS viewport issues with the virtual keyboard pushing content.

### Do not commit
When implementation is complete, **do not run `git commit` or `git push`**. Leave all changes staged or unstaged for review.

---

## Work

### 1. `netlify/functions/_services/db-signal-guest-evals.cjs`
Add two functions:
- `getGuestEvalById(gevalId)` — fetch single doc, return null if not found
- `updateGuestEval(gevalId, data)` — merge update on existing doc

### 2. `netlify/edge-functions/chat-stream.ts`
Add chatType to the handler config:
```ts
"signal-guest-coach": {
  initEndpoint: "/api/signal-guest-coach-init",
  toolExecuteEndpoint: "/api/signal-guest-coach-execute",
  signalPatterns: [],
}
```

### 3. `netlify/functions/signal-guest-coach-init.js` (NEW)
- Receives body from chat-stream: `{ gevalId, guestId, ... }`
- Fetches geval via `getGuestEvalById(gevalId)`, validates `_guestId === guestId`
- Reconstructs `distilledJd` from stored `jdSummary` (same format as `signal-guest-score.js`)
- Filters gaps for `closeable === true`, sorts by severity desc
- Returns:
  ```js
  {
    systemMessages: [
      { role: 'user', content: '<context prompt>' },
      { role: 'assistant', content: opener }
    ],
    tools: [finish_interview_tool_definition]
  }
  ```

### 4. `netlify/functions/signal-guest-coach-execute.js` (NEW)
- Handles `finish_interview` tool call
- Saves `improvements` array to geval via `updateGuestEval` (field: `coachingImprovements`)
- Returns `{ success: true }` immediately — no heavy work here

### 5. `netlify/functions/signal-guest-improve.js` (NEW)
```
POST /api/signal-guest-improve
Body: { guestId, gevalId }
CORS: same pattern as signal-guest-score.js

1. Validate guestId, gevalId
2. Fetch geval, verify _guestId === guestId
3. Read coachingImprovements from geval doc
4. Reconstruct distilledJd from jdSummary
5. Rewrite resume (Sonnet) → rescore (Sonnet)
6. If score didn't improve: retry once with harder prompt
7. Store result on geval doc
8. Return { rewrittenSections, improvedScore, originalScore, improved, improvedResumeText }
```

### 6. `src/score.njk` — redesign for 6 mobile-first states
- Remove `#score-jd-title` field entirely
- Update hero copy: `"Score your fit. Fix your resume."` / `"Paste your resume and a job description. Get scored. Then get coached through exactly what to change."`
- Score result: minimal card + one CTA `#score-coach-btn` + upsell
- Add `#score-coach` — full-height chat section (hidden initially): messages div, input form, back button
- Add `#score-building` — centered loading screen (hidden)
- Add `#score-improved` — delta + rewrite cards + upsell (hidden)

### 7. `src/assets/js/score.js` — coaching flow additions
- `startCoachChat(evalData)` — shows `#score-coach`, initializes chat, sends empty first turn
- `readStream(res, handlers)` — SSE parser (copy pattern from `src/assets/js/signal-widget.js` lines 1318–1354)
- On `tool_complete` for `finish_interview`: save `gevalId`, transition to `#score-building`, call `handleImprove()`
- `handleImprove(gevalId)` — POST to `/api/signal-guest-improve`, on response call `renderImproved()`
- `renderImproved(result)` — show `#score-improved` with delta badge + rewrite cards; update localStorage entry
- Chat history maintained in JS array, full history sent on each turn

### 8. `src/styles/_score.scss` — mobile-first chat + result styles
- `.score-coach` — full-height flex column (`height: 100dvh`), white/dark bg, replaces score view
- `.score-coach-messages` — flex-grow, overflow-y scroll
- `.score-coach-input-wrap` — fixed bottom bar, textarea + send button
- `.msg`, `.msg--user`, `.msg--assistant` — chat bubbles (user right-aligned, assistant left)
- `.score-building` — centered, full-height loading state
- `.score-improved` — result section
- `.score-delta-badge` — large "6 → 8" display
- `.score-rewrite-card` — before/after pair

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/_services/db-signal-guest-evals.cjs` | Add `getGuestEvalById`, `updateGuestEval` |
| `netlify/edge-functions/chat-stream.ts` | Add `signal-guest-coach` chatType |
| `netlify/functions/signal-guest-coach-init.js` | New |
| `netlify/functions/signal-guest-coach-execute.js` | New |
| `netlify/functions/signal-guest-improve.js` | New |
| `src/score.njk` | Redesign — 6 states, remove title field, update copy |
| `src/assets/js/score.js` | Add coaching chat, stream parsing, improve flow |
| `src/styles/_score.scss` | Add mobile-first chat + result styles |

---

## Acceptance Criteria

- [ ] Score result shows "Improve my score →" only when closeable gaps exist
- [ ] Clicking opens full-screen chat; AI sends opener and asks first question
- [ ] Vague answers prompt AI follow-up (no automatic acceptance)
- [ ] After AI calls `finish_interview`, transition to "Building..." screen automatically
- [ ] Result shows score delta and at least one before/after section
- [ ] If score didn't improve, explains why rather than failing silently
- [ ] Works cleanly on mobile (input visible above keyboard, no scroll jank)
- [ ] Refresh after improvement shows improved result from localStorage
- [ ] No closeable gaps → no "Improve" button → upsell shown directly
