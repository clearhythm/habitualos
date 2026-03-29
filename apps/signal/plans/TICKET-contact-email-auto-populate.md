# TICKET: Auto-populate contactLinks.email from owner sign-up email

## Problem
`contactLinks.email` (used for the coming-soon widget "Say Hello" button) is a separate
field from the owner's sign-up email. This is intentional — owners may want a different
public contact address. But right now it requires a manual step to set it.

## Desired behavior
When a new Signal owner is created (via `/early-access/` claim flow):
- Auto-populate `contactLinks.email` with the sign-up email as a default
- Owner can override it later in the dashboard (Contact links → Contact email)

## Where to implement
`netlify/functions/signal-early-access-claim.js` (or equivalent owner creation endpoint)
— after the owner doc is created, set `contactLinks.email` to the submitted email.

## Why it's deferred
Sign-up email is currently stored on the early-access entry, not directly on the owner
doc (owners are created manually right now). Implement when the self-serve claim flow
writes directly to `signal-owners`.
