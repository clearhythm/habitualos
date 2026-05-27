# Witness Sounds — Ticket 1: Bird Call on Witness + Return Notification

## Depends On
- `Tour-Scene-Sounds-Ticket1` — `playSceneSound()` must exist and work before this ticket is built

## App Context

Dreamscape (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS modules. No `console.log` — use `log()`. Dark mode only.

**Key files:**
- `src/assets/js/pages/home.js` — stub `playSceneSound('bird-call')` already in witness handler
- `netlify/functions/` — serverless functions for Firestore writes
- `src/assets/js/pages/practice-timer.js` — sets `dp-home-state` on session end

---

## What This Ticket Builds

Two connected behaviors:

### 1. Witness → Bird Call (frontend only)

When a user clicks **Witness** on a friend's practice session, a time-appropriate bird call plays instead of the current stub. This is a single line change once Ticket1 is done:

```js
// home.js — already stubbed, just becomes real:
function playSceneSound(type) {
  // replace stub body with real implementation from Tour-Scene-Sounds-Ticket1
}
```

No other changes needed — the witness handler already calls `playSceneSound('bird-call')`.

---

### 2. N Bird Calls on Practice Return

**Concept:** After completing a practice session and returning to the homepage, if you were witnessed by friends since your last session, you hear N bird calls — one per witness. Quiet, ambient, social without being social.

**Data model — new Firestore collection:**

`witnesses/{witnessId}` — `{ witnesserId, witnessedUserId, sessionId, createdAt }`

Written when Witness is tapped. Read on homepage load to count unseen witnesses.

**Backend — new function `witness-record.cjs`:**

```js
// POST { witnesserId, witnessedUserId, sessionId }
// Creates witnesses/{auto-id} document
// Returns { ok: true }
```

**Frontend — witness action (home.js):**

```js
celebrateBtn.addEventListener('click', () => {
  if (!_currentSession) return;
  markActedOn(_currentSession.id);
  playSceneSound('bird-call');
  // Record witness in Firestore (fire-and-forget, no await needed)
  const userId = getUserId(); // from auth-unlock or localStorage
  fetch('/api/witness-record', {
    method: 'POST',
    body: JSON.stringify({
      witnesserId: userId,
      witnessedUserId: _currentSession.userId, // add userId to QUEUE_SESSIONS entries
      sessionId: _currentSession.id,
    }),
  }).catch(err => log('warn', '[witness] record failed:', err));
  updateChimePulse();
  clearTimeout(_queueTimer);
  setTimeout(() => { advanceQueue(); }, 600);
});
```

**Frontend — return experience (home.js):**

On homepage load, after resolving `dp-home-state`:

```js
// Check for unseen witnesses since last session
async function checkWitnessReturn() {
  const userId = getUserId();
  const lastSessionTime = localStorage.getItem('dp-last-session-time') ?? '0';
  const res = await fetch(`/api/witness-count?userId=${userId}&since=${lastSessionTime}`);
  const { count } = await res.json();
  if (count > 0) {
    // Play N bird calls, staggered
    for (let i = 0; i < count; i++) {
      setTimeout(() => playSceneSound('bird-call'), i * 800);
    }
    localStorage.setItem('dp-last-witness-seen', Date.now());
  }
}
```

`practice-timer.js` sets `localStorage.setItem('dp-last-session-time', Date.now())` on session completion (alongside `dp-home-state`).

**Backend — new function `witness-count.cjs`:**

```js
// GET ?userId=&since=
// Queries witnesses where witnessedUserId == userId AND createdAt > since
// Returns { count: N }
```

**Playback of N calls:**

N is capped at 5 — if more than 5, play 5 calls with slightly increasing spacing (still feels personal, not overwhelming). Each call uses `playSceneSound('bird-call')` so time-of-day applies.

```js
const capped = Math.min(count, 5);
for (let i = 0; i < capped; i++) {
  setTimeout(() => playSceneSound('bird-call'), i * 700 + 300); // offset 300ms from page load
}
```

---

## What Does NOT Change

- `playSignature()` and the chime system — untouched
- Witness button label — stays "witness"
- The queue/state machine — untouched

---

## Verification

1. Witness a friend → bird call plays (time-appropriate)
2. Firestore: `witnesses/` collection has a new document
3. Complete a practice → return home → if you were witnessed, hear N bird calls
4. Witnessed 3 times → 3 calls, staggered ~700ms apart
5. Witnessed 7 times → 5 calls (capped)
6. Second homepage load without new practice → no calls (already seen)
7. Night hours → owl sound. Daytime → bird chirp.
