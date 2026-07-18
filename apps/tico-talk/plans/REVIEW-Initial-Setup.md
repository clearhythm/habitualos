# Initial Setup — Scaffold Hip Taco from dreamscape

**Status: §1-4 (build config, base templates, styles, JS utils) done.**
§5-9 (auth, data model, survey-engine fit, audio turn handler, page skeleton)
are architecture decisions still to be documented into their own tickets
before building — see notes inline and "Open decisions" at the bottom.

See `docs/VISION.md` and `docs/DESIGN.md` for product context.

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

## 1. Build config (Eleventy + Vite) — DONE
`eleventy.config.js` ported from `apps/dreamscape/eleventy.config.js`, trimmed
to what's actually used: Vite plugin block (workspace alias for
`frontend-utils`, scss loadPaths), `addTemplateFormats("scss")` + custom scss
compile extension, passthrough copy for `src/assets/js`. Dropped: the
`restore-passthrough` closeBundle hack and images/music passthrough (no image
or audio assets exist yet — add back when they do) and the `svgIcon`
shortcode (unused — add when inline SVGs are actually needed).

## 2. Base templates / includes — DONE
- `base.njk` — layout, meta tags, style/script includes. Dropped the
  `portrait-lock` landscape overlay (tied to dreamscape's nature-scene
  mechanic, not relevant here).
- `nav.njk` — Hip Taco nav (Home / Prepare for Shift / Stats / Profile),
  written fresh using dreamscape's masthead-toggle + sidemenu structural
  pattern as reference. No auth-gating yet (nothing to gate — see §5).
- `navigation.js` — toggle mechanism only (sidemenu open/close, `--nav-height`
  CSS var). Dropped dreamscape's auth wiring, unread-badge fetch, and
  time-of-day masthead color (all dreamscape-specific features).
- Skipped entirely (dreamscape-specific, revisit if/when needed): celebration-
  overlay, wind-chime, ambient-player, signup-steps, signin-form, admin-*.

## 3. Styles — DONE
Ported `_variables.scss`, `_base.scss`, `_layout.scss`, `_navigation.scss`,
`_components.scss`, `main.scss`. Structure only — dreamscape's palette
(purple) and `_components.scss` (nearly 2200 lines of nature-scene
animations) were **not** copied; hip-taco got a fresh placeholder palette
(warm terracotta, per standing feedback: no purple/pink, no letter-spacing on
nav labels) and a near-empty `_components.scss` (`.btn`, `.card`). Restyle for
real once product design happens — this is just a working skeleton, verified
by an actual `eleventy:build`.

## 4. JS utilities — DONE (ported from `apps/dreamscape/src/assets/js/`)
- `utils/log.js` (client) + `netlify/functions/_utils/log.cjs` (server) —
  ported as-is, per feedback memory: never console.log directly.
- `utils/id.js` — ported (`generateId`); dropped `generateReflectChatId`
  (dreamscape-specific naming, unused here).
- `utils/env-config.js` — ported as-is.
- `api.js` — ported as-is (thin fetch wrapper).
- `audio-engine.js` — ported the reusable core only (AudioContext + master
  gain, mute/volume, wake lock, visibilitychange-resume). Dropped ambient-
  track playback and the "singing bowl" one-shot effect — those referenced
  dreamscape mp3 assets that don't exist here. This is the base the future
  `getUserMedia`/`MediaRecorder` capture layer will sit on — recording itself
  is not built yet (dreamscape had no recording code to port; it was
  playback/ambient-music only despite the plan's original description).
- `audio-unlock.js` — ported as-is, with `dp-*` cookie/localStorage keys
  renamed to `ht-*`.

Not ported: `auth/auth.js`, `auth/auth-intent.js` — auth approach undecided
at scaffold time (see §5); building these now would guess at the shape.

Skipped (dreamscape-specific, not applicable): `ambient-player.js`,
`presence.js`, `scene.js`, `sky-*.js`, `nav-ripple.js`, `celebration.js`,
`chime.js`, `firebase.js`, `practice-settings.js`, `practice-logs.js`, all of
`admin/*`, all of `collections/*` and `pages/*`.

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
Discussed 2026-07-11 (scaffolding session); none of these are built yet —
write up as real tickets before starting §5-9.

- **Auth (§5):** leaning full magic-link (`@habitualos/auth-server`, mirroring
  dreamscape's proven `create-auth-token.cjs` flow) over the simple
  client-side id. Note from research: dreamscape itself doesn't use
  `@habitualos/frontend-utils`'s auth.js/auth-guard.js/auth-remote.js — it
  rolled its own local `dp-*` auth module instead. Decide whether hip-taco
  mirrors dreamscape's proven-but-forked pattern or is the first real adopter
  of the shared frontend-utils auth client.
- **OpenAI audio API surface (§8):** genuinely unresolved, needs real
  measurement, not a guess. Realtime API gives near-instant turn latency
  (matches the "immersion" goal) but costs ~$0.30/min uncached (~$0.05-0.10/min
  with prompt caching tuned) — at 4 sessions/week that's roughly $2-4/week
  tuned vs. $40+/month uncached, which was flagged as too expensive. Turn-based
  Whisper+Chat+TTS is far cheaper (low cents/session) but adds ~2-5s of
  sequential latency per turn (reducible to ~1.5-3s by streaming chat tokens
  into TTS as they generate). DESIGN.md §8 already treats a beat of "thinking
  time" as acceptable at Host tier, which favors turn-based — but "immersion"
  was also stated as a real goal, so this needs an actual cost+feel spike
  before committing, not a decision from pricing pages alone.
- **survey-engine fit (§7):** spiked — **don't adopt `focus-algorithm.cjs`
  directly.** It computes a cross-user group average per dimension (batch-
  recomputed after each full survey), not a per-user/per-node incrementally-
  updated tier. Wrong shape for Training→Capable→Natural→Mastered tracking.
  What *is* worth copying: the package's organizational pattern — pure
  algorithm function with zero DB access, thin CRUD wrapper module, one
  collection per concern (static definitions / raw append-only attempt log /
  precomputed per-user derived state). Write the actual tier algorithm from
  scratch against that shape.
