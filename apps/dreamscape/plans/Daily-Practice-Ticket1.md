# Daily Practice — Ticket 1: Firestore Real-Time Presence Service

Everything else depends on this. Sets up Firestore as the real-time backend and establishes the presence broadcasting pattern all other tickets consume.

## Data Model

**`presence/{userId}`**
```json
{
  "userId": "string",
  "name": "string",
  "state": "witnessing | practicing | idle",
  "updatedAt": "timestamp"
}
```

**`sessions/{sessionId}`**
```json
{
  "userId": "string",
  "name": "string",
  "state": "active | completed",
  "practiceType": "string (optional)",
  "note": "string (optional)",
  "startedAt": "timestamp",
  "stoppedAt": "timestamp (on complete)",
  "duration": "number (seconds, on complete)"
}
```

## Requirements

- On page load: write `presence/{userId}` with state `witnessing`
- Use Firestore `onDisconnect()` to set state to `idle` automatically on tab close/disconnect
- Timer start → update presence state to `practicing`
- Timer stop → update presence state to `witnessing`, write completed session doc
- All circle members subscribe to `presence` collection changes via `onSnapshot`
- All circle members subscribe to `sessions` collection (active sessions) via `onSnapshot`
- No polling. Push only.

## Auth Dependency

Ticket 5 (Invitations) establishes Firebase Anonymous Auth and the `circle/{userId}` user record. For this ticket, userId can be a stub pulled from localStorage — auth integration happens in Ticket 5.

## Implementation Notes

- Firebase JS SDK loaded via CDN (compat v9 for simplicity in vanilla JS context)
- Write a `src/assets/js/presence.js` module that exports: `initPresence(userId, name)`, `setPresenceState(state)`, `subscribeToCircle(callback)`
- Presence module imported by the homepage (Ticket 3) and timer page (Ticket 2)

## Definition of Done

- Presence writes and onDisconnect cleanup verified in Firestore console
- Two browser tabs can see each other's presence state update in real time
- Session document written correctly on timer stop
