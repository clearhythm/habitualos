# Community Feed — Ticket 1: Backend Data Layer

Build all server-side infrastructure. No UI yet.

## Files

- `netlify/functions/_services/db-community.cjs` (new) — Firestore service: `createReaction`, `getReactionsByPracticeId`, `deleteReaction`, `upsertReaction`
- `netlify/functions/community-feed.js` (new) — GET `/api/community-feed?userId=X&limit=20`. Fetches own + linked users' practice logs, merges, sorts. Queries reactions per entry. Strips practice name/duration/reflection before returning.
- `netlify/functions/community-react.js` (new) — POST `/api/community-react`. Toggles tappable reactions (`see_you`, `with_you`, `keep_going`) and appends notes.
- `netlify/functions/community-feed-record-witness.js` (new) — POST `/api/community-feed-record-witness`. Increments `witnessedCount` + deduplicates via `witnessedBy` set on practice log docs.
- `netlify/functions/user-profile-set.js` (update) — accept `displayName` field in addition to `phoneNumber`.
- `netlify.toml` — add 5 new redirects: `/api/community-feed`, `/api/community-react`, `/api/community-connect`, `/api/community-invite-send`, `/api/community-invite-consume`

## Data

### `community-reactions` collection
```js
{
  _id: 'r-...',
  practiceId: 'p-...',
  fromUserId: 'u-...',
  type: 'see_you' | 'with_you' | 'keep_going' | 'note',
  content: null | 'string',
  timestamp: '...'
}
```
One doc per user per reaction type per practice (upsert for toggles). Notes are append-only (multiple per user).

### User doc additions
```js
profile.displayName: 'Frank'
profile.avatarId: 'flower-07'     // randomly assigned at signup; see Flower Avatars ticket
profile.linkedUserIds: ['u-erik']
profile.invitedByUserId: 'u-erik'
```

### Practice log additions
```js
witnessedCount: 3
witnessedBy: ['u-erik', 'u-bob']
```

## Feed response shape
```js
{
  success: true,
  entries: [
    {
      id: 'p-...',
      userId: 'u-...',
      timestamp: '...',
      displayName: 'Frank',
      isOwn: false,
      witnessedCount: 2,
      reactions: [
        { id: 'r-...', fromUserId: 'u-...', fromDisplayName: 'Erik', type: 'see_you', content: null },
        { id: 'r-...', fromUserId: 'u-...', fromDisplayName: 'Erik', type: 'note', content: 'With you on this.' }
      ]
    }
  ]
}
```
Practice name, duration, and reflection are stripped server-side — never returned.

## Test

Manually patch a test user doc to add `linkedUserIds`, then:
```sh
curl "https://practice.habitualos.com/.netlify/functions/community-feed?userId=u-mgpqwa49"
# Expect: entries array with own + linked user entries, no practice name/duration/reflection

curl -X POST ... community-react with { fromUserId, practiceId, type: 'see_you' }
# Expect: { action: 'added' }
# Repeat: { action: 'removed' }

curl -X POST ... community-feed-record-witness with { viewerUserId, practiceIds: [...] }
# Expect: witnessedCount increments on the practice log docs
```
