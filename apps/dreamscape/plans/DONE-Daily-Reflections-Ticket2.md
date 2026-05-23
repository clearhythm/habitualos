# Ticket 2: Practice Page — URL Param Pre-fill

## App Context
Dreamscape is a presence-based practice timer app (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS ES modules. No build step in dev (`npm run dev` = 11ty + Netlify dev).

Dark mode only. No `console.log` — use `log()` from `src/assets/js/utils/log.js`. No uppercase/all-caps.

---

## Phase 0: Explore First

Before implementing, read these files in full:
- `src/practice.njk` — understand the form HTML (name input, duration controls)
- `src/assets/js/pages/practice.js` — understand the full module structure

Then check: does any other page in this app already read URL params? If so, note the pattern and follow it. Suggest any DRY opportunities before implementing.

---

## Overview
The upcoming Reflect AI chat feature sends users to `/practice/` with URL params pre-filled:
- `?practice=breathwork` → pre-fills the practice name input
- `?duration=10` → pre-selects the 10-minute duration option

This ticket adds that URL param reading. No visual changes, no new files.

---

## Current Practice Page Structure

`src/assets/js/pages/practice.js` already has:
```javascript
const DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60];
let durationIndex = DURATIONS.indexOf(5);  // defaults to 5 minutes
```

And a click handler that cycles `durationIndex`, updating:
```javascript
totalSeconds = DURATIONS[durationIndex] * 60;
durationValue.textContent = mins >= 60 ? `${mins / 60}h` : `${mins}m`;
```

The name input is `id="practice-name"`.

---

## Implementation

Add this block after element query variables are declared and DURATIONS/durationIndex are set up, but before any event listeners. Read the file to find the exact insertion point.

```javascript
// Pre-fill from URL params (set by /reflect/ when user is ready to practice)
const _urlParams = new URLSearchParams(window.location.search);
const _prefilledPractice = _urlParams.get('practice');
const _prefilledDuration = parseInt(_urlParams.get('duration'), 10);

if (_prefilledPractice) {
  nameInput.value = _prefilledPractice;
}

if (!isNaN(_prefilledDuration) && DURATIONS.includes(_prefilledDuration)) {
  durationIndex = DURATIONS.indexOf(_prefilledDuration);
  totalSeconds = _prefilledDuration * 60;
  remainingSeconds = totalSeconds;
  const mins = _prefilledDuration;
  durationValue.textContent = mins >= 60 ? `${mins / 60}h` : `${mins}m`;
}
```

Note: `remainingSeconds` must also be updated if it's initialized at the top of the module (check for `let remainingSeconds = totalSeconds` and update it alongside `totalSeconds`).

---

## Verification

1. Visit `/practice/?practice=breathwork&duration=10` → name input shows "breathwork", duration shows "10m"
2. Visit `/practice/?practice=meditation` → name pre-filled, duration unchanged (5m default)
3. Visit `/practice/?duration=99` → duration unchanged (99 not in DURATIONS)
4. Visit `/practice/` with no params → no change to existing behavior, no errors
5. Starting a practice with pre-filled values works identically to manually entering them
