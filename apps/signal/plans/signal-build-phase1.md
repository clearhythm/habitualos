# Signal Build — Phase 1: Erik's Alpha Widget

> **Status:** IN PROGRESS
> When phase is complete, rename to `REVIEW-signal-build-phase1.md`

## Goal

A fully working Signal experience at `signal.habitualos.com` with Erik's context hardcoded. No multi-user auth, no data upload. Serves as the demo/proof-of-concept for the Substack/LinkedIn launch.

---

## File Checklist

### Backend
- [ ] `netlify/edge-functions/_lib/chat-stream-core.ts` — copied from `packages/edge-functions`
- [ ] `netlify/edge-functions/chat-stream.ts` — configured for signal chatType + FIT_SCORE_UPDATE signal pattern
- [ ] `netlify/functions/signal-chat-init.js` — Erik's context + persona framing + FIT_SCORE_UPDATE scoring protocol
- [ ] `netlify/functions/signal-chat-save.js` — uses `@habitualos/chat-storage` (collection: signal-chats, prefix: sc)
- [ ] `netlify/functions/signal-tool-execute.js` — stub (no tools in Phase 1)
- [ ] `netlify.toml` — add edge function config (`[[edge_functions]]` block)

### Frontend
- [ ] `src/index.njk` — landing page: hero, how it works, "Try Erik's Signal" CTA
- [ ] `src/widget.njk` — chat widget page: persona selector + chat UI + Fit Score panel
- [ ] `src/assets/js/signal-widget.js` — SSE client, persona flow, FIT_SCORE_UPDATE parser, score animation
- [ ] `src/styles/_widget.scss` — widget layout, score panel, persona buttons, message bubbles
- [ ] `src/styles/main.scss` — import `_widget.scss`
- [ ] `src/_includes/nav.njk` — update with nav links

---

## Key Architecture Decisions

### Streaming
- Edge function at `/api/signal-chat-stream` uses `createChatStreamHandler` (shared core)
- `FIT_SCORE_UPDATE` is the signal protocol — emitted by Claude mid-response when confidence changes
- SSE events flow to frontend: `token`, `tool_start`, `tool_complete`, `done` (with signal data)

### Fit Score Protocol
Claude appends this block at end of message when score meaningfully changes:
```
FIT_SCORE_UPDATE
---
{"skills": 7, "alignment": 8, "personality": 6, "overall": 7, "confidence": 0.45, "reason": "..."}
```

The edge function parses it via `signalPatterns` and sends it in the `done` event as `signal.data`.
The frontend extracts it and animates the score bars.

### Chat Init
`signal-chat-init.js` returns:
- `opener` — persona-specific opening message (shown before chat begins)
- `systemMessages` — full system prompt with Erik's context + scoring protocol
- `tools: []` — no tools in Phase 1

### Chat Save
Uses `@habitualos/chat-storage` `createChatSaveHandler`:
```js
createChatSaveHandler({ collection: 'signal-chats', idPrefix: 'sc' })
```

### Score Panel Layout
Desktop: 2-column (score panel left 280px, chat right fills)
Mobile: stacked (score panel above chat, compact)

Dimensions displayed:
- Three bars: Skills / Alignment / Personality (animated width 0–100%)
- Overall ring score (SVG circle, stroke-dashoffset animation)
- Confidence meter (thin bar at bottom of panel)
- Reasoning text (visible when confidence ≥ 0.4)

---

## Env Vars Needed
- `ANTHROPIC_API_KEY` — already standard in monorepo
- `FIREBASE_ADMIN_CREDENTIALS` — for chat storage

---

## Verification Steps
1. `npm run start` in `apps/signal` → Netlify dev at localhost:8888
2. Load `/` → landing page renders
3. Load `/widget/` → persona buttons appear
4. Select persona → opener message appears in chat
5. Send messages → SSE stream works, typing indicator shows
6. After 2–3 exchanges → FIT_SCORE_UPDATE fires, score bars animate
7. Reload → chat history restored from localStorage
