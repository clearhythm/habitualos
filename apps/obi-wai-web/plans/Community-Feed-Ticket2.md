# Community Feed — Ticket 2: Connection Flows

Build the social graph wiring: personal connect link and email invite. Depends on Ticket 1 (user-profile-set.js update, netlify.toml redirects).

## Files

- `netlify/functions/community-connect.js` (new) — POST `/api/community-connect { fromUserId, targetUserId }`. Validates both users exist and aren't already linked. Patches `profile.linkedUserIds` on both docs (mutual, immediate).
- `netlify/functions/community-invite-send.js` (new) — POST `/api/community-invite-send { fromUserId, targetEmail }`. Creates invite token in `invites` collection, sends email via Resend with `/join/?token=xxx` link.
- `netlify/functions/community-invite-consume.js` (new) — POST `/api/community-invite-consume { userId, token }`. Validates token (not expired, not consumed). Marks consumed. Patches `linkedUserIds` on both users (mutual). Sets `profile.invitedByUserId` on new user.
- `src/connect.njk` + `src/assets/js/pages/connect.js` (new) — Route: `/connect/?id=[userId]`
- `src/join.njk` + `src/assets/js/pages/join.js` (new) — Route: `/join/?token=xxx`

## Connect page logic (`connect.js`)

Four user states:

1. **Signed in, has displayName**: POST `/api/community-connect` immediately with `{ fromUserId: userId, targetUserId: id }`. On success → redirect to `/practice/?joined=1`.

2. **Signed in, no displayName** (new user completing onboarding): Show name prompt inline — "What should we call you?" single text input + "Join the garden" button. On submit: POST `/api/user-profile-set { userId, displayName }`, then POST `/api/community-connect`, then redirect to `/welcome/?next=/practice/?joined=1` (welcome carousel — see Welcome Ticket).

3. **Not signed in**: Show context-first landing page: "You've been invited to Daily Practice." with two buttons: "Sign in" and "Create account" — both link to `/signin/?next=/connect/?id=[targetId]`. Do NOT silently redirect.

4. **Returning after sign-in** (`?id=` still in URL, now signed in): Check for displayName — if missing, show name prompt (state 2); if present, connect immediately (state 1) and redirect to `/welcome/?next=/practice/?joined=1` if carousel not yet seen (check `localStorage: obi_welcome_seen`), otherwise straight to `/practice/?joined=1`.

### Name prompt UI
```
┌─────────────────────────────────────┐
│  🌸  You've been invited            │
│      to the garden.                 │
│                                     │
│  What should we call you?           │
│  [ Frank                          ] │
│                                     │
│  [ Join the garden →              ] │
└─────────────────────────────────────┘
```
- Single field, autofocus
- No last name required — first name or nickname
- Shown only once; after this, name lives on the Account page

Edge cases:
- Already linked → redirect to `/practice/?already-connected=1`
- `targetUserId === fromUserId` (self-link) → redirect to `/practice/` silently

## Join page logic (`join.js`)

- If not signed in: redirect to `/signin/?next=/join/?token=xxx`
- If signed in: POST `/api/community-invite-consume { userId, token }`
- On success: redirect to `/practice/?joined=1`
- On error (expired/consumed): show inline error message

## Invites collection schema
```js
{
  _id: 'inv-...',
  inviterUserId: 'u-...',
  targetEmail: 'frank@...',   // lowercase
  consumedBy: null,
  consumedAt: null,
  createdAt: '...',
  expiresAt: '...'            // 7 days out
}
```

## Test

1. Erik shares `/connect/?id=u-mgpqwa49` → Frank (signed in on device) taps → both get `linkedUserIds` patched, redirected with "You're now connected" banner
2. Frank (not signed in) taps link → sees context landing page (not a sign-in form), taps "Sign in" → authenticates → returns to `/connect/?id=...` → connected
3. Curl community-invite-send → check Resend sends email → click link in email → join flow completes
