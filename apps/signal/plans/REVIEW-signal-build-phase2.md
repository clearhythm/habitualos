# Signal Build — Phase 2: Multi-user Platform

> **Status:** PENDING (start after Phase 1 is reviewed and merged)
> When phase is complete, rename to `REVIEW-signal-build-phase2.md`

## Goal

Anyone can create their own Signal. They upload their own Anthropic (or OpenAI) API key, configure personas, and get a JS embed snippet. Signal's shared Netlify instance powers all widgets but uses each owner's API key at runtime.

---

## New Concepts

### Signal Owner
A user who has registered on `signal.habitualos.com` to create their own Signal widget.

### Signal ID (`signalId`)
A short human-readable slug (e.g., `erik-burns`) that identifies an owner's Signal widget.
Used in embed code: `<script src="..." data-signal-id="erik-burns"></script>`

### Owner Config (stored in Firestore)
```
signal-owners/{signalId}:
  _userId: string           # Links to users/{id}
  signalId: string          # Slug
  displayName: string       # Shown in widget header
  personas: [               # Up to 4 persona configs
    {
      key: string           # e.g., "recruiter"
      label: string         # e.g., "Recruiter"
      opener: string        # Opening message for this persona
    }
  ]
  contextText: string       # Their background/bio text (Phase 2 manual entry)
  anthropicApiKey: string   # Stored encrypted
  _createdAt: Timestamp
  _updatedAt: Timestamp
```

---

## File Checklist

### Auth & Registration
- [ ] `src/register.njk` — email + signalId sign-up form
- [ ] `netlify/functions/signal-register.js` — create user + owner config doc
- [ ] Email verification via Resend (magic link or one-time code)
- [ ] `netlify/functions/signal-auth-verify.js` — verify code, set session

### Dashboard
- [ ] `src/dashboard.njk` — authenticated dashboard page
  - View/edit personas (up to 4)
  - Enter/update Anthropic API key
  - Enter context text (bio, work history, etc.)
  - Copy embed snippet
  - Preview widget inline
- [ ] `netlify/functions/signal-config-get.js` — fetch owner config by signalId
- [ ] `netlify/functions/signal-config-set.js` — update personas, API key, context text

### Embeddable JS
- [ ] `src/assets/js/signal-embed.js` — self-contained embed script
  - Reads `data-signal-id` from `<script>` tag
  - Injects floating button into host page
  - On click: opens modal iframe pointing to `/widget/?id={signalId}`
  - Handles cross-origin communication (postMessage) for resize/close
- [ ] `src/widget.njk` — update to read `?id=` param and load owner config

### Backend Updates
- [ ] `netlify/functions/signal-chat-init.js` — update to fetch owner config from Firestore by signalId, use their context text and personas instead of hardcoded Erik data
- [ ] API key passthrough — securely use owner's Anthropic key in the edge function (edge function fetches it from init endpoint, passes to Anthropic API call)

### Waitlist Page (bridge between Phase 1 and Phase 2 launch)
- [ ] `src/waitlist.njk` — email capture for people who want their own Signal
- [ ] `netlify/functions/signal-waitlist.js` — store email in Firestore, send confirmation via Resend

---

## Key Architecture Decisions

### API Key Security
- Owner's Anthropic API key is stored encrypted in Firestore (AES-256, key from env)
- Decrypted server-side in `signal-chat-init.js`, returned to edge function as part of init response
- Edge function uses it for that session only — never exposed to client

### Auth Strategy
- Reuse `@habitualos/auth-server` (`ensureUserEmail`, `updateUser`)
- Session via `localStorage` (same pattern as other HabitualOS apps)
- Dashboard protected by checking `userId` + matching owner record

### Widget Identity
- `/widget/?id=erik-burns` loads persona config for that signalId
- Default (no id param) shows Erik's demo widget (Phase 1 behavior preserved)

---

## Env Vars Needed (additions to Phase 1)
- `RESEND_API_KEY` — for email verification
- `ENCRYPTION_KEY` — for encrypting stored API keys
