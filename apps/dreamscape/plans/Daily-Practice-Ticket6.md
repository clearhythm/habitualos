# Daily Practice — Ticket 6: Chronological Session Feed

A quiet record of the circle's practice history. Not the center of the app — just available.

## Requirements

- Route: `/history/`
- Reverse-chronological list of completed sessions from the `sessions` Firestore collection
- Per session: name, practice type (if set), duration (formatted: "23 min"), optional note
- Scope: last 30 days, no infinite scroll needed for MVP
- Your own sessions are slightly highlighted — visually distinct but not loud
- No reactions, no comments, no social layer
- Accessible from homepage via a quiet link ("View history" or similar)

## Implementation Notes

- Page: `src/history/index.njk` + `src/assets/js/pages/history.js`
- Query Firestore `sessions` collection: `where state == 'completed'`, ordered by `startedAt` descending, limit to last 30 days
- Client-side query using Firebase SDK `onSnapshot` or a one-time `getDocs`
  - `onSnapshot` is fine here — new sessions will appear in real time without a refresh
- Duration display: round to nearest minute. Under 1 minute: show seconds.
- Highlight own sessions: compare `session.userId` to current user's auth UID

## Definition of Done

- Completed sessions appear in the feed after the timer stops
- Own sessions are visually distinct
- Feed updates in real time when a circle member finishes a session
- Empty state handled gracefully ("No sessions yet. Be the first.")
