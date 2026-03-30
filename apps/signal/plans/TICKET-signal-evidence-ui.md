# TICKET: Signal Evidence UI — Fit Score + Evidence For/Against

## Vision
When a conversation crystallizes into a specific role or JD, the widget renders a full
fit assessment: score ring + dimension bars + `evidenceFor` cards + `evidenceAgainst` cards.
This is the heart of what makes Signal different from a resume — it shows *why*, not just *what*.

The rest of the time, the widget is a first-person interview. Conversational, no cards.
The agent decides which path it's on. `evaluate_fit` tool call = score path. Everything else = interview path.

## Current state

### What works
- `evaluate_fit` tool fires when a JD is pasted or conversation converges on a role
- Score (skills, alignment, personality) is saved to `signal-evaluations`
- Score ring + dimension bars render in the widget (signal-modal.js)
- `strengths` and `gaps` arrays are returned and saved

### What's missing
- `evaluate_fit` tool does NOT return `evidenceFor` / `evidenceAgainst` in the widget path
  - These fields exist in `signal-evaluate.js` (the dashboard eval flow) but NOT in `signal-tool-execute.js` (the widget flow)
  - `signal-tool-execute.js` only has: `roleTitle, summary, strengths, gaps, score, recommendation`
- The widget does NOT render evidence cards after scoring
  - The Spock/Data demo renders them (signal-modal.js line 621-631) but only from the demo eval endpoint
  - The live widget shows `strengths` as "What Fits" but these are plain text bullets, not evidence-backed cards
- `search_work_history` is called by the agent conversationally but results are never surfaced visually

---

## What needs to change

### 1. `evaluate_fit` tool definition (signal-visitor-init.js)
Add `evidenceFor` and `evidenceAgainst` to the tool input schema:

```javascript
evidenceFor: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Session/chunk title this evidence comes from' },
      signal: { type: 'string', description: 'One sentence: what this session shows that supports fit' }
    }
  },
  description: '2-3 specific sessions from work history that support fit for this role'
},
evidenceAgainst: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Session/chunk title this evidence comes from' },
      signal: { type: 'string', description: 'One sentence: what this session reveals as a gap or concern' }
    }
  },
  description: '1-2 specific sessions that reveal a gap or honest concern for this role. Always include at least one.'
}
```

### 2. `signal-tool-execute.js` — pass evidenceFor/evidenceAgainst through
In the `evaluate_fit` handler, extract and save `evidenceFor`/`evidenceAgainst` from tool input,
save them to the evaluation doc, and return them in the result:

```javascript
const { roleTitle, summary, strengths, gaps, skills, alignment, personality,
        confidence, recommendation, nextStep, evidenceFor, evidenceAgainst } = input;

// save to eval doc
await upsertEvaluation(currentEvalId, { score, summary, strengths, gaps,
  recommendation, evidenceFor, evidenceAgainst });

// return in result
body: JSON.stringify({ result: {
  ok: true, evalId, roleTitle, summary, strengths, gaps, score,
  recommendation, nextStep, evidenceFor, evidenceAgainst
}})
```

### 3. `db-signal-evaluations.cjs` — store evidenceFor/evidenceAgainst
Ensure `createEvaluation` and `upsertEvaluation` include these fields. They likely
pass through already via spread but verify.

### 4. Widget UI — render evidence cards on `evaluate_fit` tool_complete
In `signal-modal.js` (and eventually embed.js after consolidation), update the
`tool_complete` handler for `evaluate_fit` to render evidence cards:

**Current** (line ~621):
```javascript
el.innerHTML = `
  <div class="eval-output">
    <h3 class="eval-output-role">${esc(roleTitle)}</h3>
    <p class="eval-output-summary">${esc(summary)}</p>
    ${strengthsHtml ? `<div class="eval-section"><h4>What Fits</h4><ul>${strengthsHtml}</ul></div>` : ''}
    ${gapsHtml ? `<div class="eval-section"><h4>Potential Gaps</h4><ul>${gapsHtml}</ul></div>` : ''}
  </div>`;
```

**Target**: replace `strengths`/`gaps` plain bullets with `evidenceFor`/`evidenceAgainst` evidence cards:
```javascript
// evidenceFor cards — green
// evidenceAgainst cards — amber/red
// Each card: chunk title (source) + signal (one sentence why it matters)
// Keep strengths/gaps as fallback if evidenceFor/evidenceAgainst are empty
```

Evidence card design (matches Spock/Data demo):
```html
<div class="eval-evidence-card eval-evidence-card--for">
  <span class="eval-evidence-label">+ For</span>
  <span class="eval-evidence-title">[session title]</span>
  <p class="eval-evidence-signal">[one sentence why this supports fit]</p>
</div>
<div class="eval-evidence-card eval-evidence-card--against">
  <span class="eval-evidence-label">− Against</span>
  <span class="eval-evidence-title">[session title]</span>
  <p class="eval-evidence-signal">[one sentence honest concern]</p>
</div>
```

### 5. System prompt — instruct agent to always find both sides
In `signal-visitor-init.js` system prompt, add to the `evaluate_fit` instructions:

```
When calling evaluate_fit:
- Always include evidenceFor: 2-3 sessions from work history that genuinely support fit
- Always include evidenceAgainst: 1-2 sessions that reveal honest gaps or concerns
- Evidence must cite real session titles from the work history you've searched
- If you haven't searched work history yet, call search_work_history first
- A score with no evidenceAgainst is not credible — always include at least one
```

---

## Data flow after this ticket

```
Visitor pastes JD or conversation converges on role
  ↓
Agent calls search_work_history (if not already done)
  ↓
Agent calls evaluate_fit with:
  { roleTitle, summary, skills, alignment, personality, confidence,
    recommendation, strengths, gaps, evidenceFor, evidenceAgainst }
  ↓
signal-tool-execute.js saves to signal-evaluations, returns all fields
  ↓
Widget renders:
  - Score ring + dimension bars (existing)
  - Role title + summary (existing)
  - Evidence For cards (NEW) — green, with session title + signal
  - Evidence Against cards (NEW) — amber, with session title + signal
  ↓
Conversation continues — agent references the score and evidence in follow-up replies
```

---

## What this does NOT change
- Conversational (non-JD) path — stays prose, no cards
- `search_work_history` tool — stays the same, results are still used by agent internally
- `update_fit_score` tool — stays the same (incremental score updates during conversation)
- Spock/Data demo — already works, no changes needed
- Embedding/vector search — deferred to post-launch (see ROADMAP POST LAUNCH)

---

## Files to touch
1. `netlify/functions/signal-visitor-init.js` — tool schema + system prompt instruction
2. `netlify/functions/signal-tool-execute.js` — extract/save/return evidenceFor/evidenceAgainst
3. `netlify/functions/_services/db-signal-evaluations.cjs` — verify fields pass through
4. `src/assets/js/signal-modal.js` — render evidence cards on evaluate_fit tool_complete
5. `src/styles/_widget.scss` — evidence card styles (may already exist from demo, verify)
6. After embed consolidation: embed.js will inherit this automatically
