# TICKET-4: Restore coming-soon modal

## Why this exists

The Signal widget supports `data-signal-mode="coming-soon"` (or `"testing"`) for owners still building their profile. This shows a small overlay instead of the full widget. The original implementation was lost in a prior commit.

**Prerequisite:** TICKET-3 complete. `index.js` has a `TESTING_MODE` no-op stub waiting to be filled.

## Known content (from prior implementation)

> 📡 Signal is coming soon.
> I'm training the agent on my actual work history. In the meantime, reach me directly — I respond to real humans.

## Work

### `openComingSoon(options)` in `index.js`

Replace the no-op stub. Injects a small centered overlay card:
- "📡 Signal is coming soon." heading
- Body copy: owner-configurable `comingSoonMessage` field, falling back to the default above
- Contact CTA from `ownerConfig.contactLinks` (calendar/LinkedIn) if `signalId` provided
- Close button

Fetch owner config via `/api/signal-config-get` if `state.signalId` is present (to get display name + contact links).

### CSS

Add `.coming-soon-overlay` styles to `widget.scss`. Centered card, max-width ~420px, backdrop, dark theme consistent with full widget. Visually distinct — not a full-screen overlay.

### Lead capture (optional scope)

Email input calling `/api/signal-lead-save` to capture visitor interest before profile is ready.

## Acceptance criteria

- [ ] `data-signal-mode="coming-soon"` shows small overlay (not full widget)
- [ ] Overlay is dismissible
- [ ] Owner name + contact shown when `signalId` provided
- [ ] Default copy renders when no owner config
