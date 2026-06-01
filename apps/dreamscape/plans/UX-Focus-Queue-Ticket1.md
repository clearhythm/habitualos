# Ticket: UX Focus Affordance Queue

## App Context

Dreamscape (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS modules. No `console.log` — use `log()` from `src/assets/js/utils/log.js`. No uppercase/all-caps. Dark mode only.

---

## Problem

The app has a recurring pattern: a pulsing ring animation draws attention to an interactive element that "wants" user action. This pattern currently appears in at least three places:

- **Wind chime** (`#wind-chime`) — pulses when there are unseen witness queue items (`chime-hint-pulse` CSS class, managed in `home.js:updateChimePulse`)
- **Nav header circle** — pulses on first visit before the user has opened the nav (exact element TBD when that feature ships)
- **Audio mute button** (proposed, `App-Audio-Unlock-Route` ticket) — pulses when the user's pref is `'on'` but the browser has suspended AudioContext

Each is currently implemented independently: each page script manages its own pulse state, adds/removes its own CSS class, and has no awareness of other claimants. On a page where multiple conditions are true simultaneously, multiple elements would pulse at once — which creates visual noise and undermines the "one calm thing asking for your attention" intent.

---

## Goal

A small module — `src/assets/js/focus-queue.js` — that acts as a single arbiter for the pulse affordance. At any moment, at most one element is pulsing. Claims are priority-ordered; the highest-priority active claim wins. When it is released (user acted), the next claim activates.

---

## Priority Order (lowest number = highest priority)

| Priority | Claimant | Condition | Release trigger |
|---|---|---|---|
| 10 | Audio mute button | `userWantsAudio()` AND AudioContext suspended | User taps button (audio resumes) |
| 20 | Wind chime | Unseen witness queue items exist | User clicks chime (enters queue) |
| 30 | Nav hint | First-time visitor, nav never opened | User opens nav |

Rationale: audio blocking is the most functionally urgent (sounds are supposed to be playing, they aren't). Witness queue is a social call-to-action. Nav hint is orientation-only and the least urgent.

New claimants added by future tickets should declare a priority constant here before shipping.

---

## API

```javascript
// src/assets/js/focus-queue.js

// Priority constants — import these, never hardcode numbers.
export const FOCUS_PRIORITY = {
  AUDIO_BLOCKED: 10,
  WITNESS_QUEUE: 20,
  NAV_HINT:      30,
};

/**
 * Claim the pulse affordance. Returns a release function.
 *
 * @param {string}   id         Unique stable ID for this claimant (e.g. 'audio-blocked')
 * @param {number}   priority   From FOCUS_PRIORITY
 * @param {Function} activate   Called when this claim becomes the active pulse — add CSS class, tooltip, etc.
 * @param {Function} deactivate Called when this claim is displaced or released — remove CSS class, tooltip, etc.
 * @returns {Function} release  Call to remove the claim entirely (e.g. user acted)
 */
export function claimFocus(id, priority, activate, deactivate) { ... }

// Internal — not exported. Re-evaluates which claim is active after any change.
function _resolve() { ... }
```

Usage example (audio mute button, in `home.js`):

```javascript
import { claimFocus, FOCUS_PRIORITY } from '../focus-queue.js';
import { userWantsAudio, isAutoplayBlocked } from '../audio-unlock.js';

if (userWantsAudio() && await isAutoplayBlocked()) {
  const release = claimFocus(
    'audio-blocked',
    FOCUS_PRIORITY.AUDIO_BLOCKED,
    () => {
      muteBtn.classList.add('is-audio-blocked');
      muteBtn.dataset.tooltip = 'tap to enable sound';
    },
    () => {
      muteBtn.classList.remove('is-audio-blocked');
      delete muteBtn.dataset.tooltip;
    }
  );

  muteBtn.addEventListener('click', async () => {
    await _audioCtx.resume();
    release();
  }, { once: true });
}
```

---

## Implementation Notes

**`_resolve()` logic:**
```
1. Find the lowest-priority-number active claim.
2. If it changed from the previous active claim:
   a. Call deactivate() on the previous active claim (if any).
   b. Call activate() on the new active claim.
3. If no claims remain, ensure nothing is pulsing.
```

**`claimFocus()` implementation:**
- Store claims in a `Map<id, { priority, activate, deactivate }>`.
- Adding a new claim calls `_resolve()`.
- The returned `release` function deletes the claim from the map and calls `_resolve()`.
- If the released claim was the active one, its `deactivate()` is called before `_resolve()` picks the next winner.

**No timers, no polling** — claims are registered/released by event-driven code. The queue is purely reactive.

---

## CSS

The pulse animation is already defined for `.chime-hint-pulse` on `#wind-chime`. Before shipping this ticket, audit the existing pulse keyframe and extract it into a shared utility class (e.g. `.focus-pulse`) in `src/styles/_components.scss`. Each claimant's `activate()` should add `.focus-pulse` (or the element-specific variant) rather than bespoke classes.

The visual should feel the same across all claimants: a radiating outward ring, same duration, same opacity curve. The goal is one recognizable "this wants your attention" language across the app.

---

## Migration

When this module ships, migrate the existing pulse implementations to use it:

1. `home.js` — `updateChimePulse()` becomes a `claimFocus` / `release` pair instead of toggling `chime-hint-pulse` directly.
2. Audio mute button pulse (from `App-Audio-Unlock-Route`) — implement using `claimFocus` from the start (do not implement inline in `home.js`; wait for this ticket or do them together).
3. Nav hint (when that feature ships) — same pattern.

---

## Verification

1. Load homepage with unseen witness items AND audio blocked AND first-time nav. Only one element pulses — the audio button (highest priority).
2. Tap audio button → audio resumes → release() called → chime now pulses (next in queue).
3. Click chime → enter witness queue → release() called → nav hint pulses.
4. Open nav → release() called → nothing pulses.
5. Reload with no conditions active — nothing pulses.
