# dreamscape — Claude Context

Standalone Netlify app within the HabitualOS monorepo. Personal audio session composer for self-directed hypnotherapy and inner work. Designed to compose trance recordings into seamless sessions, leveraging the hypnagogic state for low-friction practice.

## Quick Start

1. Read root `CLAUDE.md` (monorepo conventions)
2. Read `docs/architecture/` for system design (when created)
3. Read `docs/endpoints/` for API contracts (when created)

## Core Problem

Stitching custom trance recordings currently takes ~4 hours for a 10-15 minute session. Dreamscape makes session composition trivial and repeatable.

## MVP Features

1. **Audio segment library** — load and store recordings
2. **Session builder** — arrange segments in order
3. **Sequential playback** with smooth crossfades between segments
4. **Secondary music layer** — independent volume control, fade automation (louder between segments, quieter under voice)
5. **Per-segment music** — music can vary per segment with crossfades

## Critical Technical Requirement

Background audio must not cut out when the phone screen locks. Architecture: **Wake Lock API + Web Audio API**. Validate this before building anything else.

## Tech Approach

- 11ty + Nunjucks (same as other HabitualOS apps)
- Web Audio API for all mixing, crossfade, gain automation
- Netlify Functions for backend
- Shared streaming edge function (`packages/edge-functions/chat-stream-core.ts`) if agentic features added
- Native app via Capacitor if PWA background audio proves unreliable

## Architecture (Planned)

**Audio Engine** (`src/assets/js/audio/`)
- Web Audio API mixing, crossfade, gain automation
- Wake Lock API integration for background playback

**Segment Library** (`src/library/`, `netlify/functions/segment-*`)
- Upload, store, list audio recordings
- Metadata: title, duration, type (intro, voice, music)

**Session Builder** (`src/sessions/`, `netlify/functions/session-*`)
- Ordered segment arrangement
- Per-segment music assignment
- Volume envelope configuration

**Playback** (`src/play/`, `netlify/functions/`)
- Sequential playback with crossfades
- Music layer with independent volume

## Key Pages

- `/library/` — segment library
- `/sessions/` — session list and builder
- `/play/{sessionId}/` — session playback (to be built)

## Local Development

```
npm run dev       # netlify dev (starts 11ty + functions)
npm run serve     # serve built site
```

## ID Formats (to be defined)

- Segments: `seg-{random}`
- Sessions: `sess-{timestamp}-{random}`

## Design

- Default dark mode (sleep/nighttime use case)
- Color palette: deep indigo/violet (`#6b5ce7` primary, `#1a1735` sidemenu/footer)
- Background gradient: soft lavender (light) / deep midnight navy (dark)

## Longer Vision

- Practice tracking (session log, usage patterns)
- ACA canonical script library built in
- Sleep-entry UX optimized for hypnagogic state work
- Agentic/chat interface for session composition guidance
- Eventually standalone brand and domain
