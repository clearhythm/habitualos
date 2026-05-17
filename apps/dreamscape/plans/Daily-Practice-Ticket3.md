# Daily Practice — Ticket 3: Homepage — The Circle

The homepage is a living ambient room. You feel accompanied without being distracted by identity.

## Visual Design

**Center ring** — always present, represents you
- Pulses from small to larger radius, continuously
- Slow/gentle when witnessing, slightly more alive when practicing
- Tapping it navigates to `/practice/`
- Small muted label "practice" just below it

**Outer rings** — one per other person currently present (state: witnessing or practicing)
- Appear only when others are in the circle (not idle)
- Same pulse behavior as center ring, keyed to their state
- Slightly more opaque than center (you = full primary purple, others = ~55% opacity)
- Positioned at a radius just beyond the center ring's max size
- Tapping the outer ring area reveals names below (see below)
- If no one else is present, outer rings are absent — room feels like solitude, not emptiness

**Name reveal**
- Tapping outer rings shows a small list of who is present, fades out after ~4 seconds
- Format: first name only, state ("practicing" or "here")
- Ambient by default, identity available on demand

**Below the rings**
- Quiet link: "your history" → `/history/`

## Data Source

`subscribeToCircle()` from `presence.js` — RTDB presence, push-based.
Filter out idle members. Current user (`getCurrentUserId()`) drives the center ring.

## Implementation

- Page: `src/index.njk` + `src/assets/js/pages/home.js`
- Canvas or pure CSS/SVG animation for the rings (prefer CSS — simpler, no canvas needed for this design)
- CSS `@keyframes` pulse scaling the ring radius via `transform: scale()`
- Outer rings: rendered dynamically from presence snapshot, added/removed as people join/leave
- Name reveal: absolutely positioned text below rings, CSS opacity transition, auto-fade via setTimeout

## Definition of Done

- Center ring pulses continuously on page load
- Navigates to `/practice/` on tap
- Outer rings appear/disappear as presence changes (test with two tabs)
- Tapping outer rings reveals names, fades after 4 seconds
- "your history" link present and quiet
- RTDB presence verified across two clients (carry-over from Ticket 2 test)
