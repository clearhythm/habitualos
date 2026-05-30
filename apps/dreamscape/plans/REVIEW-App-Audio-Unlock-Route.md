# Ticket: Audio Unlock Route

## App Context

Dreamscape is a presence-based practice timer app (`apps/dreamscape`) within the HabitualOS monorepo. Frontend: 11ty + Nunjucks. Backend: Netlify Functions (Node.js CJS). Auth: edge function (`netlify/edge-functions/auth.ts`) reads a `dp-auth=1` cookie and redirects unauthenticated requests to `/signin/` before any HTML is served.

**No `console.log`** — use `log()` from `src/assets/js/utils/log.js` (frontend). No uppercase/all-caps. Dark mode only.

**Local dev:** `npm run dev` from `apps/dreamscape/` (Netlify dev at `http://localhost:8889`).

**Monorepo:** single `.git` at root. Working directory: `apps/dreamscape/`.

---

## Problem

The previous audio unlock was an overlay on top of a painted page — the page rendered first, then an inline script un-hid the splash div. This caused a visible flash of page content. Additionally, `dp-audio-pref` lived in localStorage, which the edge function cannot read.

---

## Goal

Replace the overlay with a dedicated `/audio-splash/` route gated by the edge function — same pattern as `/signin/`. First visit after signin: clean single-paint redirect. Subsequent visits: no redirect.

Return-visit pulse affordance (for when AudioContext is suspended despite pref being set) is **deferred** — see `UX-Focus-Queue-Ticket1.md`.

---

## `src/assets/js/audio-unlock.js` (MODIFY)

Pure utility module. Replaces the old `getAudioPref`/`setAudioPref` localStorage API with a cookie-based API using consistent naming. Callers never touch cookie strings directly.

**Exported API:**

```javascript
// Raw preference value — 'enabled' | 'off' | null
export function userAudioPreference() {
  const match = document.cookie.match(/(?:^|;\s*)dp-audio-pref=([^;]+)/);
  return match ? match[1] : null;
}

// Boolean — true when user explicitly chose audio
export function userRequestedAudio() {
  return userAudioPreference() === 'enabled';
}

// Writes the preference cookie (1 year)
export function setUserAudioPreference(val) {
  document.cookie = `dp-audio-pref=${val}; path=/; samesite=lax; max-age=31536000`;
}

// Async autoplay check — used by future return-visit pulse (UX-Focus-Queue-Ticket1)
export async function isAutoplayBlocked() { ... } // unchanged
```

**Deleted exports:** `getAudioPref`, `setAudioPref`, `disableAudio` — orphaned after this ticket.

**Kept:** `ensureAudioUnlocked` — still called from `ambient-player.js`, `practice.js`, and `reflect.js` to capture user gestures and satisfy browser autoplay policy. Updated internally to use `setUserAudioPreference('enabled')`.

Cookie values: `'enabled'` (user said yes) and `'off'` (user said no thanks). Both values signal "user has decided" to the edge function; only `'enabled'` makes `userRequestedAudio()` return true.

---

## Callers to update

| File | Old | New |
|---|---|---|
| `src/assets/js/pages/home.js:15` | `getAudioPref() === 'off'` | `!userRequestedAudio()` |
| `src/assets/js/pages/practice-timer.js:13` | `getAudioPref() === 'on'` | `userRequestedAudio()` |
| `src/assets/js/pages/practice-timer.js:137` | `getAudioPref() === 'off'` | `!userRequestedAudio()` |

---

## Edge Function Changes (`netlify/edge-functions/auth.ts`)

The gate works in three ordered steps. `/audio-splash/` is **not** added to the static allowlist — it still requires auth. It is excluded only from the audio-pref redirect (step 3) via a `pathname !==` guard.

```
Step 1: Static allowlist (skips all checks)
  /signin/, /dev-signin/, /signup/, /about/, /assets/, /styles/, /api/, /.netlify/, /.11ty/
  → unchanged

Step 2: Auth check
  !dp-auth=1 → redirect to /signin/
  → unchanged

Step 3: Audio pref check (NEW)
  pathname !== '/audio-splash/' && dp-audio-pref cookie not set
  → redirect to /audio-splash/?next={original pathname}

Step 4: Pass through
```

Edge function reads the cookie as: `/(?:^|;\s*)dp-audio-pref=/.test(cookie)` — presence check only, value is not inspected.

---

## New Route: `src/audio-splash.njk`

Standalone page — no nav, no footer. Front matter: `noContainer: true`, `noFooter: true`, `bodyClass: scene-page`, `noNav: true`, `pageScript: /assets/js/pages/audio-splash.js`.

**Visual:** centered layout using existing feed-message classes. Radiating circle SVG from the header. Copy:
- Title: `Daily Practice` (`.feed-name`)
- Subhead: `this is a sonic experience` (`.feed-time`)
- Primary button: `enable sound` (`.btn.btn-primary`)
- Secondary: `no thanks` (`.btn-quiet`)

---

## New Page Script: `src/assets/js/pages/audio-splash.js`

```javascript
import { setUserAudioPreference } from '../audio-unlock.js';

const params = new URLSearchParams(window.location.search);
const next   = params.get('next') || '/';

document.getElementById('enable-btn').addEventListener('click', () => {
  setUserAudioPreference('enabled');
  window.location.replace(next);
});

document.getElementById('skip-btn').addEventListener('click', () => {
  setUserAudioPreference('off');
  window.location.replace(next);
});
```

No AudioContext interaction on this page. Audio initialises on the destination page.

---

## `src/_includes/base.njk` (MODIFY)

Remove the `{% include "audio-splash.njk" %}` line and the associated inline `<script>` block that un-hides it. These are **not** pre-removed — do it as part of this ticket.

---

## `src/_includes/audio-splash.njk` (DELETE)

Delete this file entirely.

---

## `src/assets/js/auth/signin.js` (MODIFY)

Remove the `dp-audio-check` cookie block from `consumeToken()`:

```javascript
// Remove this block entirely:
if (localStorage.getItem('dp-audio-pref') === null) {
  document.cookie = 'dp-audio-check=1; path=/; samesite=lax; max-age=300';
}
```

The edge function now handles audio gating directly.

---

## `src/assets/js/pages/signup.js` — NO CHANGES

Signup plays audio (the chime assignment step) using its own `initChimeAudio()` from `chime.js`. We deliberately do not set `dp-audio-pref` during signup because:
1. The magic link may be opened on a different device.
2. The `/audio-splash/` page is intentional UX — it communicates that this is a sonic experience and lets the user consent on the device they'll actually use.

---

## Cookie Reference

| Cookie | Value | Meaning |
|---|---|---|
| `dp-audio-pref` | `enabled` | User said yes — edge function passes through; `userRequestedAudio()` returns true |
| `dp-audio-pref` | `off` | User said no thanks — edge function passes through; `userRequestedAudio()` returns false |
| *(not set)* | — | First visit after signin — edge function redirects to `/audio-splash/` |

---

## Verification

1. **First visit (no cookie):** clear all `dp-*` cookies. Sign in. Should redirect to `/audio-splash/` before homepage loads. No flash of homepage content.
2. **Enable path:** click "enable sound" → `dp-audio-pref=enabled` cookie set → redirected to `/` → audio plays normally.
3. **Skip path:** click "no thanks" → `dp-audio-pref=off` cookie set → redirected to `/` → no audio, no prompt.
4. **Return visit:** `dp-audio-pref` set → no redirect → homepage loads directly.
5. **`?next` param:** navigate directly to `/reflect/` with no audio pref → redirect to `/audio-splash/?next=/reflect/` → after choosing, land on `/reflect/`.
6. **Signin regression:** sign in fresh → no `dp-audio-check` cookie → no overlay → clean redirect to `/audio-splash/` via edge function.
7. **Unauthenticated direct hit:** navigate to `/audio-splash/` without `dp-auth` cookie → redirected to `/signin/` (not served directly).
