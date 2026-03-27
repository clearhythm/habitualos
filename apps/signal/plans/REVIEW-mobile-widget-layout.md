# Ticket: Mobile Widget Layout — Compact Header Pattern

## Goal

Implement a mobile-responsive layout for the Signal fit widget that preserves the full agent context on load, then compacts it once the conversation starts.

## Current State

On mobile (`≤ $breakpoint-md`) the score panel is hidden (`display: none`) and a compact score bar appears at the bottom of the chat panel. The profile panel has no mobile treatment — it just disappears. The widget effectively becomes chat-only on mobile with no agent identity or profile context.

## Desired Behavior

### Initial state (before first message)

```
┌─────────────────────────────┐
│  ◎  Erik's Agent            │
│                             │
│       [  avatar  ]          │
│                             │
│  My agent is designed to    │
│  help you assess my fit…    │
│                             │
│  • 17 Claude Code sessions  │
│  • 2 repositories →         │
│                             │
│  Last updated today         │
│                             │
│  [ Book a call → ]          │
├─────────────────────────────┤
│                             │
│  Hi! Ask me anything about  │
│  Erik's recent work, or     │
│  paste a JD and I'll        │
│  evaluate the fit…          │
│                             │
├─────────────────────────────┤
│ [Tell me about your AI… ▶] │
└─────────────────────────────┘
```

### After first message sent

Profile card compacts to a slim header row. Score appears inline once available.

```
┌─────────────────────────────┐
│ ◎ Erik's Agent  ·  72 ↓    │  ← tap to expand profile/score
├─────────────────────────────┤
│  Hi! Ask me anything…       │
│                             │
│  ┌─────────────────────┐   │
│  │ You: [message]      │   │
│  └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│ [Tell me about your AI… ▶] │
└─────────────────────────────┘
```

### Tap compact header → sheet slides up

Full profile + score detail in a bottom sheet overlay.

## Implementation Plan

### 1. CSS — mobile profile card

- Stack `.signal-panel--score` above `.signal-panel--chat` on mobile (currently hidden)
- Profile card shows full-height, scrollable if needed
- Remove `display: none` on `.signal-panel--score` for mobile; replace with stacked layout
- Add `.is-compacted` state on `.signal-panel--score` for the slim header row

### 2. CSS — compacted header

```scss
.signal-panel--score.is-compacted {
  height: auto;           // shrink to single row
  overflow: hidden;
  // show only .signal-mobile-header, hide everything else
}

.signal-mobile-header {
  display: none;          // only visible on mobile + compacted
}
```

### 3. HTML — add mobile header row

Add a `.signal-mobile-header` element inside `.signal-panel--score`:

```html
<div class="signal-mobile-header" id="signal-mobile-header">
  <span class="signal-mobile-agent-name">Erik's Agent</span>
  <span class="signal-mobile-score" id="mobile-score-pill"></span>
  <span class="signal-mobile-chevron">↓</span>
</div>
```

### 4. JS — trigger compact on first send

In `signal-modal.js`, after the first user message is appended:

```javascript
// Compact profile panel on first message (mobile)
if (!state.profileCompacted && window.innerWidth <= BREAKPOINT_MD) {
  scorePanelEl?.classList.add('is-compacted');
  state.profileCompacted = true;
}
```

Update mobile score pill when score arrives in `updateScorePanel()`.

### 5. JS — tap to expand (bottom sheet)

Tap on `.signal-mobile-header` toggles `.is-expanded` class, which slides the full profile/score panel up as an overlay above the chat.

---

## Files to change

| File | Change |
|------|--------|
| `src/_includes/modal.njk` | Add `.signal-mobile-header` element |
| `src/styles/_widget.scss` | Mobile stacking, `.is-compacted`, sheet overlay |
| `src/assets/js/signal-modal.js` | Compact trigger on first send, score pill update, tap-to-expand toggle |

## Out of scope

- Tablet breakpoint (treat same as desktop for now)
- Swipe gestures (can add later)
- Score detail in the sheet beyond what's already in `.signal-score-inner`
