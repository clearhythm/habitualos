# Firestore DB Optimization

## Status: Low priority — revisit when user base grows

## Context

Investigated Jun 11 2026 after seeing 7.7K reads/day and 1.1K writes/day in the Firestore console. With 4 users and 1 active this seemed alarming, but the investigation found the app is healthy:

- **Presence is RTDB, not Firestore** — no heartbeat writes to Firestore
- **No client-side `onSnapshot` listeners** — all reads are REST calls to Netlify functions
- **Actual call volume is light** — api-logs show ~25 calls/day, dominated by `witness.queue.get` + `user.profile.get` firing together on each home page load
- **Peak read counts were likely console browsing** — the Firestore console bills reads against quota; browsing `api-logs` during development investigation was probably the spike source
- **`note.unreadCheck` barely fires** — `dp-has-unread` LS cache is working well

## Genuine Future Improvements (when scale warrants)

### 1. Cache `user.profile.get` in sessionStorage
Fires on every home page load (~11x/day) but data rarely changes. Already planned in june1 V2 notes: cache with `dp-profile-` prefix, write-through on settings save.

### 2. Cache `witness.queue.get`
Also fires on every home page load with no cache. A short TTL (5–10 min) or invalidation on `session.complete` would reduce this significantly.

### 3. `circle.load` query audit
Less frequent (~2-3x/day) but likely the highest reads-per-call since it queries connections + notes + users across all circle members. Worth understanding the fan-out before the circle grows.

### 4. API log duplicate writes
june1 notes flagged ~3x writes per API call in `handle()`. Current code only shows one `logRequest` call — may already be fixed, or was never as described. Verify before acting.

## Not Issues

- Presence heartbeat — doesn't exist, RTDB only
- Collection-level onSnapshot — no Firestore listeners in the app at all
- Overall read/write volume — proportionate to actual usage at current scale
