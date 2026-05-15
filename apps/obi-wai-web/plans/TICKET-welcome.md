# Welcome — Onboarding Carousel

Shared onboarding step for all new users, regardless of entry path (invite link or direct signup). Collects display name and shows a 3-card orientation carousel. Depends on Ticket 1 (`user-profile-set.js`).

## Entry points

- **Invite path**: connect page saves displayName → redirects to `/welcome/?next=/practice/?joined=1`
- **Direct signup**: magic link click → if no `displayName`, redirect to `/welcome/?next=/practice/`
- **Learn more** link on landing page → `/welcome/` (carousel only, no name prompt, CTA at end is "Create an account →" → `/signin/`)

## Route

`/welcome/` — `src/welcome.njk` + `src/assets/js/pages/welcome.js`

## Flow

### Step 0 — Name (conditional)
Only shown if `profile.displayName` is not yet set. Already collected on connect page for invite path, so direct signups see this; invitees skip to step 1.

```
┌─────────────────────────────────────┐
│  Welcome to Daily Practice.         │
│                                     │
│  What should we call you?           │
│  [ Frank                          ] │
│                                     │
│  [ Continue →                     ] │
└─────────────────────────────────────┘
```
On submit: POST `/api/user-profile-set { userId, displayName }`, advance to carousel.

### Steps 1–3 — Carousel

3 cards, swipeable (touch + arrow buttons), dot indicator, skip link top-right.

**Card 1 — Your practice**
> "Pick something you want to show up for. Log it after you do it. Over time, you'll start to see what's working — and why."

**Card 2 — The garden**
> "Everyone in your circle has a flower. When they practice, their flower blooms. You can see who's been tending their practice — and they can see you. Invite a friend and your garden grows."

**Card 3 — Obi-Wai**
> "Need a nudge? Talk to Obi-Wai. He'll help you figure out what to practice, work through resistance, and stay honest with yourself."

Last card CTA: "Get started →" (or "Create an account →" if unauthenticated / learn-more path).

## Seen state

After carousel completes or is skipped: set `localStorage: obi_welcome_seen = true`. Never show again unless manually revisited.

## Revisitable

Add "About this app" link to the Account page (and nav) → `/welcome/`. Carousel plays again; name prompt skipped since displayName already set.

## Files

| Action | File |
|--------|------|
| new | `src/welcome.njk` |
| new | `src/assets/js/pages/welcome.js` |
| new | `src/styles/_welcome.scss` (carousel styles) |
| modify | `src/styles/main.scss` — add `@import 'welcome'` |
| modify | `src/_includes/nav.njk` — add "About this app" link |
| modify | `netlify.toml` — add `/api/welcome` redirect if needed |

## Carousel interaction

- Swipe left/right (touch events)
- Left/right arrow buttons
- Dot indicators (tap to jump)
- Skip link top-right on all cards
- Keyboard: left/right arrow keys

## Test

1. New user via invite link → name collected on connect page → `/welcome/` shows carousel (no name prompt) → "Get started" → `/practice/?joined=1`
2. New user via direct signup → magic link → `/welcome/` shows name prompt → continue → carousel → "Get started" → `/practice/`
3. "Learn more" from landing page → `/welcome/` shows carousel → "Create an account →" → `/signin/`
4. Existing user visits `/welcome/` from Account page → carousel only, no name prompt
5. `obi_welcome_seen` set after completion — revisit from Account page works, but landing page `/welcome/` never auto-redirects returning users
