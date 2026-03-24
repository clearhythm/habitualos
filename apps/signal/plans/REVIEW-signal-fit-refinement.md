# Plan: "Refine Fit" — Open Owner Chat with Eval Context

## Context

After running a dashboard eval, there's no path to discuss or push back on the score. The owner chat widget exists on the dashboard page (`showDemoModal: true`) but is only reachable via the sidemenu. A "Refine Fit" button should open the widget in owner mode with the just-evaluated JD and score already in context — so the AI opens the conversation with "I see you just evaluated X, does that score feel right?" rather than asking the user to paste a JD again.

---

## How it works today

- `window.signalOpen({ mode: 'owner', signalId })` opens the modal and transitions to owner mode
- `AGENTS.owner.init()` POSTs `{ signalId }` to `/api/signal-owner-init`
- The server returns `{ opener, systemMessages, tools }` — opener is a static string
- The widget infrastructure (HTML, JS, CSS) is already included on the dashboard page via `showDemoModal: true`

---

## What needs to change

### 1. `netlify/functions/signal-owner-init.js` — context-aware opener + system prompt injection

Accept optional `evalContext` in the request body. If present:
- Build a context-aware opener referencing the role and score
- Inject an `== RECENT EVALUATION ==` section into the system prompt so the AI can reference it in follow-ups

```javascript
const { signalId, evalContext } = JSON.parse(event.body || '{}');

// Opener
let opener;
if (evalContext?.roleTitle) {
  const s = evalContext.score || {};
  opener = `I see you just evaluated **${evalContext.roleTitle}** — ${s.overall ?? '?'}/10 overall (Skills ${s.skills ?? '?'}, Alignment ${s.alignment ?? '?'}). Does that score feel right, or is something off?`;
} else {
  opener = "You're viewing your own Signal. Paste a job description to see how you'd score against it — or ask me anything about your profile.";
}

// System prompt section (append before closing)
let evalSection = '';
if (evalContext?.roleTitle) {
  const s = evalContext.score || {};
  const gaps = (evalContext.gaps || []).map(g => typeof g === 'string' ? g : g.gap);
  evalSection = `\n\n== RECENT EVALUATION ==\nRole: ${evalContext.roleTitle}\nScore: ${s.overall ?? '?'}/10 overall — Skills ${s.skills ?? '?'}, Alignment ${s.alignment ?? '?'}\nSummary: ${evalContext.summary || ''}\nWhat Fits: ${(evalContext.strengths || []).join('; ')}\nPotential Gaps: ${gaps.join('; ')}\n\nThe owner is likely here to discuss or refine this evaluation. Reference it directly.`;
}
```

### 2. `src/assets/js/signal-modal.js` — thread evalContext through open → transition → init

**`transition(modeName, options)`** (line ~478): store `evalContext` in state:
```javascript
state.evalContext = options.evalContext || null;
```

**`AGENTS.owner.init()`** (line ~432): include evalContext in the POST body:
```javascript
body: JSON.stringify({
  signalId: state.signalId,
  ...(state.evalContext ? { evalContext: state.evalContext } : {}),
})
```

### 3. `src/assets/js/dashboard.js` — add "Refine Fit" button + wire click

Store full eval result in a module-level variable `currentEvalData` when `renderEvalResult()` is called:
```javascript
currentEvalData = data;
```

Add "Refine Fit →" as the **first button** in the `eval-actions` div, before generate resume/cover:
```html
<button type="button" class="btn btn-outline" id="eval-refine-btn">Refine Fit →</button>
<button type="button" class="btn btn-ghost" id="eval-resume-btn">Generate resume →</button>
<button type="button" class="btn btn-ghost" id="eval-cover-btn">Generate cover letter →</button>
```

Wire click:
```javascript
document.getElementById('eval-refine-btn').addEventListener('click', () => {
  const ownerSignalId = localStorage.getItem('signal-owner-id');
  if (!ownerSignalId || !currentEvalData) return;
  window.signalOpen({
    mode: 'owner',
    signalId: ownerSignalId,
    evalContext: {
      roleTitle: currentEvalData.roleTitle || document.getElementById('eval-title')?.value || '',
      score: currentEvalData.score,
      summary: currentEvalData.summary,
      strengths: currentEvalData.strengths || [],
      gaps: currentEvalData.gaps || [],
    },
  });
});
```

---

## Files to change

| File | Change |
|------|--------|
| `netlify/functions/signal-owner-init.js` | Accept `evalContext`; build context-aware opener + inject eval section into system prompt |
| `src/assets/js/signal-modal.js` | Store `evalContext` in state during `transition()`; pass it in owner `init()` POST body |
| `src/assets/js/dashboard.js` | Store `currentEvalData`; add Refine Fit button; wire click to `window.signalOpen()` |

---

## Verification

1. Run a dashboard eval → eval panel renders
2. Click "Refine Fit →" → owner widget opens
3. Widget opener says "I see you just evaluated [Role Title] — X/10 overall..."
4. Reply "that alignment score feels off" → AI references the eval, calls `save_preference_update`
5. Open widget without a prior eval → original opener appears unchanged
6. History click → load old eval → Refine Fit button works with that eval's data too
