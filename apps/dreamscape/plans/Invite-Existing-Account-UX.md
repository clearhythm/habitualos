# Invite Flow — Existing Account UX

## Problem

A user who already has an account (identified by email) can be invited to join a circle. They follow the invite link, go through the full signup flow (name → chime → email), and enter their existing email at step 3. Currently:

- The server recognizes the email and sends a sign-in link to the existing account
- **The connection to the inviter is now created** (fixed June 2026 — `create-auth-token` stores connection-only `pendingRegistration` for existing users)
- But the UX is misleading: the user filled in a name and chime, clicked through steps, and there is no signal that they already have an account. Their new name/chime are silently discarded.
- After clicking the magic link they land on the homepage as their existing self, with no indication that the invite connection was established.

## What Should Happen

1. At the email step, when the submitted email matches an existing account, the UI should surface that clearly:
   - "Looks like you already have an account. We sent you a sign-in link to `<email>` — click it to connect and join the circle."
   - Or: block sending and show "an account with this email already exists — [sign in instead →]" with a button that goes to `/signin/` (cleaner, avoids sending a redundant email).

2. The connection to the inviter must still be created when they sign in (this is now handled server-side via `pendingRegistration`, but the UX should make clear they're joining the circle, not signing up fresh).

3. The name and chime they entered during signup should be offered as an update to their existing profile (opt-in, not automatic). Out of scope for now.

## Implementation Notes

### Option A — Signal at email step, still send link (simpler)
- `auth-magic-link-send` returns `{ ok: true, existing: true }` when it detects an existing user
- `signup.js` detects `data.existing === true` and changes the `step-sent` copy to reflect sign-in rather than signup

### Option B — Block and redirect (better UX, slightly more work)
- Before/instead of sending the link, show an inline message: "An account with this email already exists."
- Provide a "sign in instead" button that navigates to `/signin/?connectUserId=<inviterId>` (or stores the inviter in localStorage) so the connection is established on sign-in
- Requires `/signin/` to check for a pending `connectUserId` and trigger `user-register` after auth

### Recommended
Option A is a fast, low-risk improvement. Option B is the right long-term UX but requires the signin page to handle the connection context.

## Related
- `netlify/functions/_utils/create-auth-token.cjs` — handles existing vs new user on magic link send
- `src/assets/js/pages/signup.js` — email step submit handler
- `src/assets/js/auth/signin.js` — `completePendingRegistration`
