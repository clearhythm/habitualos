# Initial Setup — Scaffold Hip Taco from dreamscape

Placeholder ticket. High-level pass only — flesh out sub-tickets when picking
this up. See `docs/VISION.md` and `docs/DESIGN.md` for product context.

## Before starting: audit what's already here
A parallel process already began this scaffold and was interrupted
mid-stream (it did not leave behind a local `CLAUDE.md` — see below). The
"Already in place" list below is a snapshot from this planning session, not
a guarantee of current state. Before copying anything from dreamscape,
re-check what already exists in this app (`package.json` deps, `netlify.toml`,
every path named in §1-9 below) so nothing gets clobbered or duplicated —
diff against dreamscape rather than assuming a clean slate.

## Missing: app-level CLAUDE.md
Per the monorepo convention (root `CLAUDE.md`), every app needs its own
`apps/hip-taco/CLAUDE.md` with app-specific context (stack notes, key
files, data model, env vars) — the interrupted setup never created one.
Write this alongside or right after the scaffolding work, once the
decisions in §5/§7/§8 are actually made — a CLAUDE.md written before those
are settled will just go stale.

## Already in place
- `package.json` — deps on `@habitualos/auth-server`, `@habitualos/db-core`,
  `@habitualos/frontend-utils` already added; `sass` + `vite` +
  `eleventy-plugin-vite` in devDependencies.
- `netlify.toml` — base config points at `apps/hip-taco`, functions/edge
  functions wired, `/api/*` redirect in place.
- Empty placeholder dirs: `src/_includes`, `src/styles`,
  `src/assets/js/{auth,utils}`, `netlify/functions/_utils`,
  `netlify/edge-functions`.

## 1. Build config (Eleventy + Vite)
- **Missing entirely**: `eleventy.config.js`. Copy from
  `apps/dreamscape/eleventy.config.js` and adapt:
  - Vite plugin block (workspace alias for `frontend-utils`, scss loadPaths,
    `restore-passthrough` closeBundle hack for images — drop the `music`
    passthrough, we likely don't need it, but keep the pattern).
  - `addTemplateFormats("scss")` + custom scss compile extension.
  - Passthrough copies for `src/assets/js` and `src/assets/images`.
  - `svgIcon` shortcode (only if we end up with inline SVGs).

## 2. Base templates / includes
Copy and trim from `apps/dreamscape/src/_includes/`:
- `base.njk` — base layout, script/style includes, meta tags.
- `nav.njk` — will need a Hip Taco-specific nav (Prepare for Shift / Stats /
  Profile) but use dreamscape's as structural reference.
- Skip celebration-overlay, wind-chime, ambient-player, signup-steps,
  signin-form, admin-* includes unless/until we actually need auth UI —
  revisit once auth-server wiring is decided (see §5).

## 3. Styles
Copy `apps/dreamscape/src/styles/` structure as a starting skeleton
(`_variables.scss`, `_base.scss`, `_layout.scss`, `_components.scss`,
`main.scss`) then **restyle for Hip Taco's own look** once scaffolding
works end to end — don't invest in visual design before the loop runs.

## 4. JS utilities to port from `apps/dreamscape/src/assets/js/`
Definitely relevant:
- `utils/log.js` (client) + `netlify/functions/_utils/log.cjs` (server) —
  standard logging pattern, per feedback memory: never console.log directly.
- `utils/id.js` — user id generation helper.
- `utils/env-config.js` — env exposure pattern for client JS.
- `api.js` — fetch wrapper pattern for calling Netlify functions.
- `audio-engine.js` + `audio-unlock.js` — directly relevant: recording /
  playback primitives for push-to-talk. This is the highest-value port.
- `auth/auth.js`, `auth/auth-intent.js` — pairs with `@habitualos/auth-server`
  + `@habitualos/frontend-utils` (auth-guard, auth-remote) for per-user
  identity.

Skip (dreamscape-specific, not applicable): `ambient-player.js`, `presence.js`,
`scene.js`, `sky-*.js`, `nav-ripple.js`, `celebration.js`, `chime.js`,
`firebase.js` (check if db-core already wraps this), `practice-settings.js`,
`practice-logs.js` (Hip Taco needs its own session/tier log shape, see §6),
all of `admin/*` (revisit only if we want an admin view later), all of
`collections/*` and `pages/*` (dreamscape-specific page controllers — Hip
Taco's page JS is net-new).

## 5. Auth
Reuse `@habitualos/auth-server` + `@habitualos/frontend-utils` as-is (already
a dependency). Port `netlify/functions/_utils/create-auth-token.cjs` pattern
if magic-link/token auth is wanted, or start with the simpler client-side
`u-{timestamp}-{random}` id pattern (per root CLAUDE.md) if full auth is
overkill for a personal MVP. Decide before building — don't build both.

## 6. Data model (db-core, new — not a port)
No existing dreamscape schema maps to this. Sketch only, confirm before
building:
- `users/{userId}/skillTree/{nodeId}` — current tier (Training / Capable /
  Natural / Mastered), last-assessed timestamp.
- `users/{userId}/sessions/{sessionId}` — scenario logs, per-beat
  transcripts + assessment notes.
- `generatedPhrases` — logged AI-generated target phrasing, tagged by node +
  session (per DESIGN.md §6 — captured, not yet consumed).
- `reflections/{userId}/...` — post-shift voice reflections (transcribed,
  captured, manually reviewed per DESIGN.md §7).

## 7. survey-engine — evaluate before building a parallel system
Flagged as the one genuinely promising reuse candidate. Before writing
custom tier-tracking logic, read `packages/survey-engine/survey-focus.cjs`
and `focus-algorithm.cjs` and check whether its "focus dimension" computation
can directly drive the confidence-tier-per-node model (DESIGN.md §2-3),
rather than reinventing it. This needs an actual read-through + spike, not
just this summary — time-box it.

## 8. Audio turn handler — net new, not a port
`edge-functions` (Claude SSE streaming) is the wrong shape for this. Build a
plain Netlify function (not an edge function): takes an audio blob (or
audio + text context), calls OpenAI (Whisper transcription + chat + TTS, or
evaluate Realtime API in turn-based mode), returns audio + assessment
metadata. Confirm which OpenAI API surface before building — turn-based
request/response is simplest and matches the push-to-talk decision in
DESIGN.md §8.
- New env var needed: `OPENAI_API_KEY`.

## 9. Page skeleton (net new)
Rough shape, not final: home ("Prepare for Shift" CTA + current tree/tier
state), session/practice view (roleplay + push-to-talk UI), stats view
(skill tree per DESIGN.md §1, tier per node). Build after §1-2 scaffolding
works, not before.

## Open decisions before/while building
- Auth: full magic-link (auth-server) vs. simple client-side id? (§5)
- OpenAI audio API surface: Whisper+TTS turn-based vs. Realtime API in
  turn-based mode? (§8)
- survey-engine fit: adopt, adapt, or pass? (§7) — do this spike early since
  it affects the data model in §6.
