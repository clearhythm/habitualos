# Daily Practice — Ticket 3: Homepage Waveform Visualization

The homepage is the room. A living visual that reflects how many people are present — not a dashboard, not a feed.

## Requirements

- Animated waveform rendered on `<canvas>`, always visible
- Two ambient states driven by presence count:
  - **Empty** (0 people): slow, sparse, low-amplitude breathing wave
  - **Present** (1+ people): richer, slightly higher amplitude, warmer; more people = more complex layering
- The waveform reflects *collective* presence only — not who specifically
- Names appear ambientally as events happen: "Frank joined." / "Ro'i is practicing." / "Frank finished."
  - Fade in, hold ~4 seconds, fade out
  - Not a persistent list — just a quiet event stream
- Link to session history (`/history/`) present but quiet — not centered
- Link to start a practice (`/practice/`) — the primary action, but not aggressive

## Data Source

Subscribe to Firestore presence collection via `presence.js` from Ticket 1. Drive all visualization state from presence snapshots.

## Implementation Notes

- Page: `src/index.njk` + `src/assets/js/pages/home.js`
- Canvas animation loop using `requestAnimationFrame`
- Waveform: simple sine wave composition — base frequency + 1-2 harmonics that grow with presence count
- Keep the math simple: this is ambience, not scientific visualization
- Name events: listen for presence state changes in the `onSnapshot` callback, generate human-readable event strings, append to a queue that fades in/out via CSS opacity transitions

## Definition of Done

- Waveform animates on page load
- When a second browser tab sets presence to `witnessing`, waveform visibly shifts
- Name events appear and fade correctly as presence state changes
