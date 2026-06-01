# User Chime — LS Cache + Practice Complete Bell

The user's personal chime signature should be available instantly everywhere it's needed,
without waiting on a profile API round-trip. Store it in localStorage on write, read from
LS on load, sync to Firestore in the background.

## Problem

`_userChime` in `home.js` is fetched async from `/api/user-profile-get`. Until that resolves,
it's null — so the caught-up chime falls back to `SELF_CHIME` and the practice-complete bowl
plays with no personal chime at all. This is a race condition, not a design choice.

## Changes

### 1. LS key: `dp-user-chime`

Store the chime signature as JSON: `{ notes: [...], timing: [...] }`.

Helpers to add to `audio-unlock.js` (alongside the existing audio LS helpers):

```js
export function getUserChime() {
  const raw = localStorage.getItem('dp-user-chime');
  return raw ? JSON.parse(raw) : null;
}
export function setUserChime(sig) {
  localStorage.setItem('dp-user-chime', JSON.stringify(sig));
}
```

### 2. Signup + Settings pages — write to both LS and Firestore

Both pages call the profile API and get back (or generate) a chime signature.
After writing to Firestore, also call `setUserChime(sig)` so LS is in sync.

Files: `src/assets/js/pages/signup.js`, `src/assets/js/pages/settings.js`

### 3. home.js — read from LS immediately, update when API returns

```js
let _userChime = getUserChime();  // instant, no network
```

Then in the `Promise.all` resolve:

```js
if (chime) {
  _userChime = chime;
  setUserChime(chime);  // keep LS in sync with DB
}
```

### 4. Practice complete — play user's chime after the bowl

After the bowl fades on practice complete, play the user's chime on the home page.
The home page already handles this via `_pendingChime = SELF_CHIME` — replace `SELF_CHIME`
with `getUserChime() ?? SELF_CHIME` so it uses the real chime if available.

File: `src/assets/js/pages/home.js`, the `just-practiced` LS block.

## Definition of Done

- Signup generates a chime → writes to Firestore + LS
- Settings changes chime → writes to Firestore + LS
- Home page reads chime from LS on load (no API wait)
- Caught-up screen plays user's chime (not SELF_CHIME fallback) for users who have one
- Practice complete landing plays user's personal chime
- If LS is empty (first visit before signup), SELF_CHIME is the fallback everywhere
