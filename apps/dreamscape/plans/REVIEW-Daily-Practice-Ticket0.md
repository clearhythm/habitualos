# Daily Practice — Ticket 0: Project Setup & Rebrand

Repurpose the `apps/dreamscape` prototype into the Daily Practice app. The core audio/wake lock architecture is reusable; the dreamscape-specific pages and concept are not.

## What to Keep

- `src/assets/js/pages/wakelock-test.js` — extract into `src/assets/js/audio-engine.js` (reusable module: AudioContext, Wake Lock, gain management, visibility change handling)
- `src/assets/music/ambient-paulyudin.mp3` — keep as default ambient track
- SCSS architecture (`_variables`, `_base`, `_components`, `_layout`, `_navigation`)
- `netlify/edge-functions/` — leave untouched for now

## What to Remove

- `src/library/` — dreamscape audio library page, not relevant
- `src/sessions/` — dreamscape session builder page, not relevant
- `src/wakelock-test/` — replaced by extracted audio engine module
- `src/assets/js/pages/library.js`, `sessions.js` — remove
- Nav links pointing to library/sessions

## New Page Structure

| Route | File | Purpose |
|---|---|---|
| `/` | `src/index.njk` | The room — waveform + presence |
| `/practice/` | `src/practice/index.njk` | Full-screen timer |
| `/history/` | `src/history/index.njk` | Chronological session feed |
| `/invite/` | `src/invite/index.njk` | Invitation landing (reads token from URL) |
| `/admin/` | `src/admin/index.njk` | Admin — generate invites |

## CLAUDE.md Update

Update `apps/dreamscape/CLAUDE.md` to reflect Daily Practice: new concept, new routes, Firestore dependency, Firebase Anonymous Auth.

## Tech Stack Additions

- Firebase JS SDK (loaded via CDN for MVP) — Firestore + Anonymous Auth
- No new build tools — stay on 11ty + Nunjucks + vanilla JS

## Definition of Done

- Dreamscape-specific pages removed
- Audio engine extracted to `src/assets/js/audio-engine.js`
- New page stubs in place (even if just shells with placeholder content)
- Nav updated to reflect new structure
- CLAUDE.md updated
