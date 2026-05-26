# Ticket 3b: Reflect Chat — Dynamic Greeting

## Context
Part of the Ticket 3 review cycle. Read `REVIEW-Daily-Reflections-Ticket3.md` for full backend context.

**Depends on:** Vite migration (workspace package imports must resolve in browser JS before this can be implemented).

---

## Goal
Replace the hardcoded opener in `reflect.js`:
```
"What's present for you today?"
```
with a personalized, time-aware greeting:
```
"Good evening, Erik — what's present for you today?"
```

---

## Work

### 1. `packages/frontend-utils/utils.js` — add two utilities

```js
/**
 * Get the user's browser timezone (IANA string).
 * e.g. "America/Los_Angeles"
 */
export function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get a time-of-day greeting word based on the browser's local hour.
 * Returns: 'morning' | 'afternoon' | 'evening' | 'night'
 */
export function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}
```

### 2. `packages/frontend-utils/auth.js` — add to Field Helpers section

Import at top:
```js
import { getTimezone, getTimeOfDayGreeting } from './utils.js';
```

Add to Field Helpers:
```js
/**
 * Get the user's current time context.
 * Useful for personalized greetings and passing tz to the server.
 */
export function getUserTimeContext() {
  return {
    timezone: getTimezone(),
    greeting: getTimeOfDayGreeting(), // 'morning' | 'afternoon' | 'evening' | 'night'
  };
}
```

### 3. `src/assets/js/pages/reflect.js` — update opener

```js
import { getName } from '../auth/auth.js';
import { getTimeOfDayGreeting } from '@habitualos/frontend-utils/utils.js';

// In the init block, replace the hardcoded opener:
const greeting  = getTimeOfDayGreeting();
const firstName = getName().split(' ')[0] || null;
const content   = firstName
  ? `Good ${greeting}, ${firstName} — what's present for you today?`
  : `Good ${greeting} — what's present for you today?`;
```

---

## Notes
- `getName()` already exists in dreamscape's `src/assets/js/auth/auth.js` — returns `localStorage.getItem('dp-name') || ''`
- The opener is still rendered with `.chat-bubble--intro` (centered) — no change to that logic
- `getTimezone()` is already sent to the backend via `Intl.DateTimeFormat().resolvedOptions().timeZone` in the stream call — this just makes it a shared utility
