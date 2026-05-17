# Daily Practice — Claude Context

Standalone Netlify app within the HabitualOS monorepo (hosted in the `apps/dreamscape` directory). A presence-based practice timer for a small, invitation-only circle. The app is a room that is always alive — you come to practice, your circle witnesses you, and the room reflects how many people are present through ambient sound and a living waveform.

Target domain: `daily.habitualos.com`

## Quick Start

1. Read root `CLAUDE.md` (monorepo conventions)
2. Read `plans/` for ticket specs

## Core Concept

No feed, no kudos, no performance. Just presence. Real-time Firestore presence (witnessing / practicing / idle) drives the waveform visualization and ambient audio layer.

## Tech Stack

- **Frontend**: 11ty + Nunjucks, vanilla JS modules
- **Real-time**: Firebase Firestore `onSnapshot` (push only, no polling)
- **Auth**: Firebase Anonymous Auth tied to invite token
- **Audio**: Web Audio API (`src/assets/js/audio-engine.js`) + Wake Lock API
- **Backend**: Netlify Functions

## Key Files

| File | Purpose |
|---|---|
| `src/assets/js/audio-engine.js` | Web Audio API + Wake Lock — shared by all pages |
| `src/assets/js/presence.js` | Firestore presence module (Ticket 1) |
| `src/index.njk` | Homepage — the room (waveform + presence) |
| `src/practice.njk` | Full-screen practice timer |
| `src/history.njk` | Chronological session feed |
| `src/invite.njk` | Invitation landing page |
| `src/admin.njk` | Admin — generate invite links |

## Routes

- `/` — the room
- `/practice/` — timer
- `/history/` — session feed
- `/invite/` — invitation landing (reads `?token=` from URL)
- `/admin/` — admin (obscure URL, no nav link)

## Data Model

**`presence/{userId}`** — `{ userId, name, state: witnessing|practicing|idle, updatedAt }`

**`sessions/{sessionId}`** — `{ userId, name, state: active|completed, practiceType, note, startedAt, stoppedAt, duration }`

**`invitations/{token}`** — `{ token, createdAt, expiresAt, inviterName, usedAt, usedBy }`

**`circle/{userId}`** — `{ userId, name, joinedAt, inviteToken }`

## Build Order (Tickets)

0. Project setup ✓ (this)
1. Firestore presence service
2. Practice timer
3. Waveform visualization
4. Ambient audio
5. Invitation system
6. Session feed

## Local Development

```
npm run dev       # netlify dev (starts 11ty + functions)
```

## Design

- Default dark mode
- Nature/presence aesthetic — earthy, calm, not corporate
- No individual performance tracking in the room visual — collective presence only
