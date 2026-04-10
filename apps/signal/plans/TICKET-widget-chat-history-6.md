# TICKET-6: Widget chat history (localStorage persistence)

## Why this exists

Currently, visitor chat sessions are lost on page reload. The server saves conversations via `/api/signal-chat-save`, but the widget doesn't restore them on reload. Adding localStorage persistence means returning visitors see their prior conversation.

**Prerequisite:** TICKET-3 complete. `core/history.js` has `saveChat` (server-side only). This ticket fills in the rest.

## Work

### Extend `core/history.js`

Add:
```js
export function saveHistory(state, chatHistoryKey)
// JSON.stringify(state.chatHistory) → localStorage[chatHistoryKey]

export function loadHistory(state, chatHistoryKey, chatIdKey)
// Parse localStorage, restore state.chatHistory + state.chatId
// Returns true if history found and restored

export function clearHistory(chatHistoryKey, chatIdKey)
// Remove both keys from localStorage
```

### Key scheme (in visitor.js)

```js
const chatHistoryKey = `signal_chat_${state.signalId}`;
const chatIdKey = `signal_chat_id_${state.signalId}`;
```

### visitor.js changes

In `init()`: call `loadHistory(state, chatHistoryKey, chatIdKey)`. If history loaded:
- Render prior messages (call `appendMessage` for each)
- Skip the default greeting
- Don't call `signal-visitor-init` again (the opener is already in history)

In `persist()` / after each `done` event: call `saveHistory` + `saveChat`.

On `Signal.close()` or explicit clear: call `clearHistory`.

### Considerations

- History is per-`signalId` (not global) — visitors on different profiles don't share history
- TTL: consider adding an expiry (e.g., 7 days) to avoid stale history
- Score state is NOT restored (too complex; score panel starts fresh)

## Monorepo note

Check `@habitualos/db-core` or other packages for any existing client-side persistence utilities before implementing from scratch.

## Acceptance criteria

- [ ] Visitor conversation persists across page reload
- [ ] Returning visitor sees prior chat, no duplicate greeting
- [ ] Clear history when visitor explicitly starts over (if a "start over" UI exists)
- [ ] No cross-profile history bleed
