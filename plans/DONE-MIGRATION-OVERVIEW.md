# Signal-to-Tools Migration — Overview & Sequencing

## What This Is

Two architectural changes applied across all AI apps in the HabitualOS monorepo:

1. **Signals → Tools**: Replace all typed text signals (GENERATE_ACTIONS, GENERATE_ASSET, STORE_MEASUREMENT, SAVE_MOMENT, SEND_REPLY, FIT_SCORE_UPDATE) with Claude API tool_use blocks. Eliminates stream buffering, signal leakage, and client-side parsing complexity.

2. **Survey sub-agent pattern**: Extract survey delivery into a reusable tool-based sub-agent in `@habitualos/survey-engine`. Apps get consistent conversational survey UX (consent-first, one question at a time, confirm before saving) without re-implementing it.

---

## Execution Order

```
TICKET-00   ←── run FIRST (package foundation)
    │
    ├── TICKET-01 (habitual-web)  ←── can run in parallel
    ├── TICKET-02 (obi-wai-web)   ←── depends on TICKET-00
    ├── TICKET-03 (relationship-web) ←── depends on TICKET-00
    └── TICKET-04 (signal app)    ←── can run in parallel
```

**Phase 1 (run first):**
- `TICKET-00` — Extend `packages/survey-engine` with tool handler API

**Phase 2 (run after TICKET-00, can parallelize within phase):**
- `TICKET-01` — habitual-web signals → tools (independent of TICKET-00 but safe to run after)
- `TICKET-02` — obi-wai-web survey UX fix + STORE_MEASUREMENT → tools (requires TICKET-00)
- `TICKET-03` — relationship-web all 3 signals → tools (requires TICKET-00)
- `TICKET-04` — signal app FIT_SCORE_UPDATE → tool (independent, run anytime)

**Phase 3 (cleanup, run last):**
- `TICKET-05` — fix circular dependency in survey-engine handlers.cjs

---

## Signal Inventory (what gets removed)

| Signal | App(s) | Replaced By |
|--------|--------|-------------|
| GENERATE_ACTIONS | habitual-web | `create_action` tool (already exists) |
| GENERATE_ASSET | habitual-web | `create_asset` tool (new) |
| STORE_MEASUREMENT (measurement actions) | habitual-web | `store_measurement` tool (new) |
| STORE_MEASUREMENT (survey) | obi-wai-web, relationship-web | `store_survey_results` tool (from package) |
| SAVE_MOMENT | relationship-web | `save_moment` tool (new) |
| SEND_REPLY | relationship-web | `send_reply` tool (new) |
| FIT_SCORE_UPDATE | signal | `update_fit_score` tool (new) |

---

## What Gets Deleted After Migration

- `apps/habitual-web/netlify/functions/_agent-core/signal-parser.cjs`
- All `signalPatterns` arrays in every app's `chat-stream.ts` (set to `[]` or remove)
- Dual-buffer (streamingText/displayText) logic in `apps/relationship-web/src/chat.njk`
- Signal format instructions in all system prompts

---

## Key Files Per App

| App | Init Endpoint | Tool Executor | Client JS | Edge Config |
|-----|---|---|---|---|
| habitual-web | `agent-chat-init.js` | `agent-tool-execute.js` | `agent.js` | `edge-functions/chat-stream.ts` |
| obi-wai-web | `obi-wai-chat-init.js` | `practice-tool-execute.js` | `practice/chat.njk` | `edge-functions/chat-stream.ts` |
| relationship-web | `rely-chat-init.js` | `rely-tool-execute.js` (CREATE) | `chat.njk` | `edge-functions/chat-stream.ts` |
| signal | 3 init files | `signal-tool-execute.js` | `signal-modal.js`, `embed.js` | `edge-functions/chat-stream.ts` |

---

## Notes for Autonomous Execution

- Always read each file fully before editing — don't assume structure from filename alone
- Match existing Firestore collection names and field shapes exactly — don't invent new ones
- The shared streaming core at `packages/edge-functions/chat-stream-core.ts` does NOT need changes — setting `signalPatterns: []` is sufficient to disable signal parsing
- Each app has a local copy of `chat-stream-core.ts` at `netlify/edge-functions/_lib/chat-stream-core.ts` — these are synced from the package and should not be edited directly
- `@habitualos/db-core` only supports `eq` and `array-contains` query operators — filter in JS for anything else
- Never commit `.env` or credentials
