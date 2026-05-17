# Daily Practice — Ticket 2: Full-Screen Practice Timer

The core loop of the app. Extends the existing wake lock + audio + timer from `wakelock-test.js` — do not rewrite, extract and extend.

## What Already Exists (from wakelock-test.js)

- Wake Lock API request, release, and re-acquire on visibility change
- AudioContext with looping ambient track and gain control
- Count-up timer (MM:SS display)
- AudioContext suspend/resume handling when page is hidden

## New Requirements

- Full-screen takeover UI when timer is running (no nav, no distractions)
- Before starting: optional text input for practice name (e.g. "Meditation", "Breathwork")
- Timer display: large, minimal. Default is count-up (open-ended). Optional: set a duration for countdown.
- Controls: Start / Pause / Stop
- Ambient audio starts automatically when timer starts (using audio-engine.js from Ticket 0)
- Timer state broadcast to Firestore presence in real time (using presence.js from Ticket 1)
- On Stop: show optional note field ("What came up?"), then confirm to save
- On confirm: write completed session to Firestore, return to homepage

## Implementation Notes

- Page: `src/practice/index.njk` + `src/assets/js/pages/practice.js`
- Import `audio-engine.js` and `presence.js`
- Wake Lock acquired on timer start, released on timer stop
- Full-screen state: add a CSS class to `<body>` or wrapper that hides nav, fills viewport

## Definition of Done

- Timer starts, counts up, screen stays on (wake lock active) with ambient audio
- "Erik is practicing" presence update visible in Firestore in real time
- Stop → note → save writes a complete session document
- Returning to homepage after stop feels natural
