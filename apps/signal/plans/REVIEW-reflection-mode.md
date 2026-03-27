# Ticket: Reflection Mode — Balanced Personality Signal Collection & Presentation

## Context

Signal's ingest pipeline currently captures `personalitySignals` as a flat string array, skewed toward positive framing. This ticket adds a `reflectionMode` owner setting (`"standard" | "coach"`) that controls whether personality signals are extracted with positive polarity only, or with balanced polarity — both strengths and edges.

Collection and presentation are treated as separate concerns: coach mode captures more honestly; what gets shown to visitors is always filtered to strengths only regardless of mode.

This is foundational infrastructure for Signal's "human potentiation" vision — an honest behavioral record the owner can use for self-understanding, while the public-facing widget remains professionally appropriate.

**Naming: `polarity: "strength" | "edge"`**
- `strength` — what the person brings; shown publicly
- `edge` — patterns worth examining; owner-facing only
- "Edge" carries a double meaning: a boundary to be aware of, and sharpness (not inherently negative)

---

## Schema Changes

### 1. `personalitySignals` — `string[]` → `{ signal: string, polarity: "strength" | "edge" }[]`

Each entry gains a polarity tag. Existing plain strings normalize to `{ signal: s, polarity: "strength" }` — no migration needed.

### 2. Owner doc — add `reflectionMode: "standard" | "coach"` (default: `"standard"`)

---

## Files to Change

| File | Change |
|------|--------|
| `netlify/functions/signal-ingest.js` | Normalize `personalitySignals` — accept tagged objects or plain strings |
| `netlify/functions/signal-context-process.js` | Fetch owner `reflectionMode`; coach mode extraction prompt requests both polarities |
| `netlify/functions/signal-context-synthesize.js` | Separate `strengthSignals` and `edgeSignals` in `personalityProfile` |
| `netlify/functions/signal-visitor-init.js` | Only inject `strengthSignals` into RAG system prompt |
| `netlify/functions/signal-owner-init.js` | Inject both polarities, clearly labeled |
| `src/dashboard.njk` + `src/assets/js/dashboard.js` | Add `reflectionMode` toggle in settings; edge signals in owner-only dimension view |
| `CLAUDE.md` (root) | Update ingest payload to use tagged object format |

---

## Implementation Detail

### signal-ingest.js
```js
const normalizedSignals = (personalitySignals || []).map(s =>
  typeof s === 'string' ? { signal: s, polarity: 'strength' } : s
);
```

### signal-context-process.js
Look up owner's `reflectionMode` before Claude extraction call. In coach mode, append to extraction prompt:
> "Also extract edge signals — honest observations about patterns worth examining: friction responses, avoidance, scope issues. Tag each signal with polarity: 'strength' or 'edge'."

Standard mode: extract only `strength` signals (current behavior).

### signal-context-synthesize.js
```js
const strengthSignals = topN(strengthFreq, 10);
const edgeSignals     = topN(edgeFreq, 8);
personalityProfile = { ...existingFields, strengthSignals, edgeSignals, completeness }
```

### signal-visitor-init.js
Inject only `strengthSignals`. Edge signals never leave owner-facing context.

### signal-owner-init.js
```
Personality strengths: [...]
Edges (owner context only — do not surface to visitors): [...]
```

### Dashboard
- `reflectionMode` toggle in settings section (Standard / Coach)
- Dimension completeness: edge signals in separate muted expandable section

### Root CLAUDE.md — ingest payload format
```json
"personalitySignals": [
  { "signal": "cuts scope decisively when aesthetics feel wrong", "polarity": "strength" },
  { "signal": "frustration surfaces quickly under repeated execution friction", "polarity": "edge" }
]
```

---

## Presentation Rules (invariant)

| Context | Shown |
|---------|-------|
| Visitor widget / chat | `strengthSignals` only |
| Owner dashboard | Both, visually separated |
| Owner chat agent | Both, labeled |
| RAG context (visitor) | `strengthSignals` only |
| RAG context (owner) | Both |

---

## Future Vision (out of scope)

**Real-time edge detection** — the agent noticing behavioral signals *during* a working session and gently surfacing them in the moment. Not as judgment, but as reflection. This requires its own design phase, separate consent model, and significant iteration on how and when it surfaces. How it surfaces is art, not science.

---

## Verification

1. Set `reflectionMode: "coach"` via dashboard toggle
2. Ingest a session with tagged signals — verify chunk stores `{ signal, polarity }` objects
3. Run `signal-context-synthesize` — verify `personalityProfile` has both `strengthSignals` and `edgeSignals`
4. Open visitor widget — verify only strength signals surface in agent behavior
5. Open owner chat — verify agent has access to edge signals and can reference them when owner asks probing questions
6. Dashboard — verify edge signals appear in owner-only section, not visible externally
