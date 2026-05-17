# Daily Practice — Ticket 5: Invitation System

No one can use the app without being invited. This ticket also establishes the auth layer that Tickets 1-4 stub with localStorage.

## Data Model

**`invitations/{token}`**
```json
{
  "token": "string (random, URL-safe)",
  "createdAt": "timestamp",
  "expiresAt": "timestamp (72 hours)",
  "inviterName": "string",
  "usedAt": "timestamp (null until accepted)",
  "usedBy": "string userId (null until accepted)"
}
```

**`circle/{userId}`**
```json
{
  "userId": "string (Firebase anonymous auth UID)",
  "name": "string",
  "joinedAt": "timestamp",
  "inviteToken": "string"
}
```

## User Flow

1. Admin generates invitation link at `/admin/` → stored in Firestore as `invitations/{token}`
2. Link shared with invitee: `https://daily.habitualos.com/invite/?token={token}`
3. Invitee lands on `/invite/` — sees "Erik has invited you to Daily Practice" + name input field
4. Invitee enters name, taps Join → Firebase Anonymous Auth creates a user → circle record written → invitation marked used → redirected to homepage
5. On subsequent visits: Anonymous Auth persists via Firebase SDK (tied to browser) — user is recognized automatically

## Admin View (`/admin/`)

- No public link to this page (obscure URL is sufficient for MVP)
- Simple form: enter invitee's name (for "X has invited you" message), generate link
- List of existing invitations with status (pending / accepted / expired)
- Netlify Function: `netlify/functions/invite-create.js` — generates token, writes to Firestore, returns link

## Security Notes

- Firestore rules: `circle/{userId}` writable only by that userId. `invitations/{token}` readable by anyone (needed to validate on invite page), writable only by admin or the accepting user.
- Admin write operations go through a Netlify Function with a secret key — not direct Firestore writes from the client.
- Single-use: on accept, mark `usedAt` + `usedBy` and reject any subsequent use of the same token.
- Expired tokens (past `expiresAt`) are rejected server-side.

## Implementation Notes

- `/invite/` page reads `?token=` from URL, fetches invitation from Firestore to validate
- On valid token: show name form. On invalid/expired/used: show clear error message.
- Auth: `signInAnonymously()` from Firebase Auth, then write circle record with the display name
- Store userId in localStorage as fallback for any non-auth reads

## Definition of Done

- Admin can generate an invite link
- New user clicks link, enters name, lands on homepage as a recognized circle member
- Presence writes use the Firebase Auth UID (not a stub)
- Used/expired tokens are rejected with a clear message
- Invited users cannot generate invites
