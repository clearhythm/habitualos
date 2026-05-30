# Ticket: Audio Unlock Route

## App Context

Dreamscape is a presence-based practice timer app (`apps/dreamscape`) within the HabitualOS monorepo. Frontend: 11ty + Nunjucks. Backend: Netlify Functions (Node.js CJS). Auth: edge function (`netlify/edge-functions/auth.ts`) reads a `dp-auth=1` cookie and redirects unauthenticated requests to `/signin/` before any HTML is served.

**No `console.log`** — use `log()` from `src/assets/js/utils/log.js` (frontend). No uppercase/all-caps. Dark mode only.

**Local dev:** `npm run dev` from `apps/dreamscape/` (Netlify dev at `http://localhost:8889`).

**Monorepo:** single `.git` at root. Working directory: `apps/dreamscape/`.

---

## Architecture Note (updated after practice-bells work)

`src/assets/js/audio-unlock.js` has been refactored into a **pure utility module** — no IIFE, no side effects on import. It now exports:

- `getAudioPref()` / `setAudioPref(val)` — localStorage read/write (`'on'` / `'off'` / null). **This ticket changes these to cookies** — see the Modify section below.
- `ensureAudioUnlocked()` — async, must be called inside a click/tap handler. Creates/resumes an AudioContext using the gesture, sets pref to `'on'`. The new `/audio-unlock/` page's "enable sound" button should call this.
- `disableAudio()` — sets pref to `'off'`. The "no thanks" button should call this.
- `isAutoplayBlocked()` — async check, used for return-visit pulse detection in home.js.

The `audioReady` custom event no longer exists. Do not reference it anywhere.

The `dp-audio-check` cookie and the `audio-splash.njk` overlay no longer exist.

---

## Phase 0: Read These Files First

Before implementing, read:

1. `netlify/edge-functions/auth.ts` — full file. Understand: the cookie check pattern, the allowlist, how the redirect to `/signin/` works. This ticket mirrors that pattern exactly.

2. `src/assets/js/auth/signin.js` — full file. Find `consumeToken()`. Understand how `dp-auth=1` is set as a cookie and how `window.location.replace(dest)` redirects after signin. The audio unlock page will follow the same pattern.

3. `src/assets/js/audio-unlock.js` — full file. Read the current exports. This ticket changes `getAudioPref()` / `setAudioPref()` to use cookies instead of localStorage, and changes the value strings from `'on'`/`'off'` to `'enabled'`/`'skipped'`.

4. `src/_includes/base.njk` — full file. The `{% include "audio-splash.njk" %}` block and associated inline script have already been removed in a prior step. Verify they are gone before making changes.

5. `src/index.njk` — find `ambient-mute-btn`. This is the homepage sound control that will receive the pulse animation when AudioContext is suspended on return visits.

6. `src/assets/js/pages/home.js` — find `muteBtn` and `wireGestureResume`. Understand how the homepage currently handles suspended AudioContext. The pulse logic will be added here using `isAutoplayBlocked()` from `audio-unlock.js`.

After reading, proceed. Do not deviate from the patterns you observe.

---

## Problem

The current audio unlock is an **overlay on top of a painted page** — the page renders first, then an inline script un-hides the splash div. This causes a visible flash of page content, which breaks the app's calm first impression. Additionally:

- `dp-audio-pref` lives in **localStorage**, which the edge function cannot read — so audio state cannot be checked server-side
- `dp-audio-check=1` is a short-lived cookie (5 min TTL) set at signin — on return visits hours later it has expired, so the splash never appears even though audio is blocked

---

## Goal

Replace the overlay with a dedicated `/audio-unlock/` route gated by the edge function — same pattern as `/signin/`. First visit: clean single-paint redirect. Return visits: no redirect, subtle inline affordance on the sound control if AudioContext is suspended.

---

## Edge Function Changes (`netlify/edge-functions/auth.ts`)

Add `/audio-unlock/` to the allowlist (same as `/signin/`). Then extend the auth logic:

```
1. Not signed in → redirect to /signin/          (unchanged)
2. Signed in + dp-audio-pref cookie not set → redirect to /audio-unlock/?next={original pathname}
3. Signed in + dp-audio-pref cookie set → pass through
```

The check order matters: unauthenticated users go to signin, never to audio-unlock. The `next` param preserves the original destination.

---

## New Route: `src/audio-unlock.njk`

Standalone page — no nav, no footer, no content behind it. Use `noContainer: true`, `noFooter: true`, `bodyClass: scene-page`.

**Visual:** centered layout. Reuse the radiating circle SVG from the header circle icon (same `<path>` elements, larger size). This is the app's visual language for "something alive here."

**Copy:**
- Name/title: `Daily Practice` (use `.feed-name` class — Cormorant Garamond, same as homepage)
- Subhead: `this is a sonic experience` (use `.feed-time` class)
- Primary button: `enable sound` (use `.btn.btn-primary`)
- Secondary: `no thanks` (use `.btn-quiet`)

**Page script** (`src/assets/js/pages/audio-unlock.js`):

On load:
1. Read `?next` from URL params (default `/`)
2. On "enable sound" click:
   - Set cookie: `dp-audio-pref=enabled; path=/; samesite=lax; max-age=31536000`
   - `window.location.replace(next)`
3. On "no thanks" click:
   - Set cookie: `dp-audio-pref=skipped; path=/; samesite=lax; max-age=31536000`
   - `window.location.replace(next)`

No AudioContext interaction needed on this page — the user gesture is collected here, but audio is initialized on the destination page.

---

## `src/assets/js/audio-unlock.js` (MODIFY)

The file is already a pure utility module (no IIFE, no side effects). This ticket changes `getAudioPref()` / `setAudioPref()` to use **cookies** instead of localStorage, so the edge function can read the pref server-side.

Value strings also change: `'on'` → `'enabled'`, `'off'` → `'skipped'`.

```javascript
export function getAudioPref() {
  const match = document.cookie.match(/(?:^|;\s*)dp-audio-pref=([^;]+)/);
  return match ? match[1] : null; // 'enabled' | 'skipped' | null
}

export function setAudioPref(val) {
  document.cookie = `dp-audio-pref=${val}; path=/; samesite=lax; max-age=31536000`;
}
```

`ensureAudioUnlocked()` already calls `setAudioPref('on')` — update that call to `setAudioPref('enabled')`.
`disableAudio()` already calls `setAudioPref('off')` — update to `setAudioPref('skipped')`.

**After this change**, all callers that check `getAudioPref() === 'on'` must be updated to check `=== 'enabled'`. Files to update:
- `src/assets/js/pages/practice-timer.js` — `_audioEnabled` check
- `src/assets/js/pages/home.js` — `_muted = getAudioPref() === 'off'` becomes `=== 'skipped'`

`isAutoplayBlocked()` stays unchanged — it is used by `home.js` for return-visit pulse detection.

---

## `src/_includes/base.njk` (ALREADY DONE — verify only)

The `{% include "audio-splash.njk" %}` block and its associated inline script were removed in a prior step. Verify they are absent. The `audio-unlock.js` script tag was already gated by `{% if not noAudioUnlock %}` — leave this as-is; it controls which pages load the utility module.

---

## `src/_includes/audio-splash.njk`

Delete this file.

---

## `src/assets/js/auth/signin.js` (MODIFY)

Remove the `dp-audio-check` cookie from `consumeToken()`:
```javascript
// Remove this block entirely:
if (localStorage.getItem('dp-audio-pref') === null) {
  document.cookie = 'dp-audio-check=1; path=/; samesite=lax; max-age=300';
}
```

The edge function now handles audio gating — the short-lived check cookie is no longer needed.

---

## Return Visit: Pulse on Sound Control (`src/index.njk` + `src/assets/js/pages/home.js`)

On return visits, `dp-audio-pref=enabled` is set so no redirect occurs. But the browser may still suspend AudioContext (mobile, new tab, strict policy).

**Detecting suspension:** `home.js` already calls `isAutoplayBlocked()` (imported from `audio-unlock.js`). If blocked and pref is `enabled`:
- Render the button in its **muted/off state** — same visual as when the user has manually muted. This is the honest state: audio is not playing.
- Add class `is-audio-blocked` to `#ambient-mute-btn` for the pulse animation
- Show tooltip: `tap to enable sound` (use existing `data-tooltip` attribute pattern)
- On button click: call `audioContext.resume()`, remove `is-audio-blocked` class, flip button to on state, start audio

**CSS** (`src/styles/_components.scss`): add a subtle radiating pulse keyframe on `.ambient-mute-btn.is-audio-blocked` — same radiating outward circle pattern used in the header. Should feel alive, not alarming. Remove `.audio-splash` styles.

**When NOT blocked** (most desktop return visits): no pulse, sound control renders normally.

---

## Cookie Reference

| Cookie | Value | Meaning |
|---|---|---|
| `dp-audio-pref` | `enabled` | User said yes to sound — edge function passes through |
| `dp-audio-pref` | `skipped` | User said no thanks — edge function passes through |
| *(not set)* | — | First visit — edge function redirects to `/audio-unlock/` |

Both `enabled` and `skipped` bypass the redirect. The pulse only appears when `enabled` AND AudioContext is suspended.

Set with: `dp-audio-pref=enabled; path=/; samesite=lax; max-age=31536000`

---

## What Does NOT Change

- Signin flow — entirely unchanged
- Audio engine internals (`audio-engine.js`) — only initialization trigger changes
- The radiating circle SVG — reused as-is
- All other page routes and templates
- `isAutoplayBlocked()` — stays in `audio-unlock.js`, imported by pages that need it

---

## Verification

1. **First visit (no cookie):** clear all `dp-*` cookies. Sign in. Should redirect to `/audio-unlock/` before homepage loads. No flash of homepage content.

2. **Enable path:** click "enable sound" → `dp-audio-pref=enabled` cookie set → redirected to `/` → audio plays normally.

3. **Skip path:** click "no thanks" → `dp-audio-pref=skipped` cookie set → redirected to `/` → no audio, no prompt.

4. **Return visit (desktop):** `dp-audio-pref=enabled` set → no redirect → homepage loads directly → audio plays if AudioContext not suspended.

5. **Return visit (blocked AudioContext):** simulate by opening in a new tab with no prior interaction. Sound control should show in muted/off state with pulse. Tapping it resumes audio, removes pulse, flips button to on state.

6. **`?next` param:** navigate directly to `/reflect/` with no audio pref → should redirect to `/audio-unlock/?next=/reflect/` → after enabling, should land on `/reflect/`, not `/`.

7. **Signin regression:** sign in fresh → no `dp-audio-check` cookie set → no overlay on homepage → clean redirect to `/audio-unlock/` via edge function instead.
