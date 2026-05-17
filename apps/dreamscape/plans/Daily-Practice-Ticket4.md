# Daily Practice — Ticket 4: Ambient Audio Layer

The room makes sound. Audio is always present on the homepage and during practice. Extend the existing Web Audio API architecture — do not rewrite.

## What Already Exists (from audio-engine.js, extracted in Ticket 0)

- AudioContext with looping ambient track
- Gain node for volume control
- AudioContext suspend/resume on visibility change

## Requirements

- Ambient audio plays automatically on homepage (low volume default)
- Audio layers respond subtly to presence count — more people = slightly richer/warmer sound
  - MVP: single track with gain adjusted by presence count is sufficient
  - Stretch: crossfade between a sparse version and a fuller version of the ambient track
- Same ambient audio continues on the `/practice/` timer page
- User can mute (single toggle, not a volume slider for MVP)
- Wake Lock ensures uninterrupted playback during practice (already handled in Ticket 2)

## Visual Selector (Low Priority)

Allow user to choose a background visual preset (trees, water, minimal). Each preset ties to a slight audio variation or just a visual change. Not prominent — accessible from a quiet settings area. Can be deferred post-MVP.

## Implementation Notes

- `audio-engine.js` (from Ticket 0) handles all AudioContext management
- Homepage (`home.js`) calls audio engine on load; presence subscription drives gain adjustments
- Practice page imports the same audio engine — audio should feel continuous if navigating between pages (note: full page load will restart audio, which is acceptable for MVP)
- Mute state persisted in `sessionStorage` so it survives page navigation within the session

## Definition of Done

- Ambient audio plays on homepage load (after first user interaction to satisfy browser autoplay policy)
- Mute toggle works
- Gain shifts noticeably (even if subtly) when presence count increases
- Audio plays during timer session with wake lock active
