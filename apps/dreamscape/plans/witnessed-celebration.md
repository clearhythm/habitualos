# DONE - Witnessed Celebration — Status & Next Session

## What's built and shipped

The "you were witnessed" moment is now integrated into the witness queue as the first item. When you open the app and someone has witnessed you, the chime pulses (same as when there are friends to witness). You tap it and see:

```
You
were witnessed

[ play ]    skip
```

- **Pan flute** plays your own chime signature (same notes/timing, different instrument) when the entry appears
- **[Play]** → sky glow blooms from the bottom, strings music swells from a random offset, each witness name floats up ("Frank witnessed you"), auto-advances after the sequence
- **[Skip]** → advances immediately, marks seen
- `lastWitnessSeen` is only set on Play or Skip — refreshing without interacting keeps the entry alive

## Key files

| File | What changed |
|---|---|
| `netlify/functions/witness-queue-get.cjs` | Prepends `{ type: 'witnessed-by', witnesses }` if unseen; no longer marks seen here |
| `netlify/functions/witnessed-by-mark-seen.cjs` | New — POST, sets `lastWitnessSeen` |
| `netlify/functions/collections/witness-logs.cjs` | `getUnseenWitnesses(userId)` — deduped, filtered by `lastWitnessSeen` |
| `src/assets/js/pages/home.js` | `showSession` branch, `showWitnessedByActions`, `playPanFluteChime`, `showWitnessNames`, [Play] handler, `advanceQueue` marks seen |
| `src/assets/js/collections/witness-queue.js` | `markWitnessedSeen` export |
| `src/assets/music/effects/pan-flute.mp3` | New asset |
| `src/assets/music/ambient/witnessed.mp3` | New asset — 60s mono 64kbps strings |
| `src/styles/_components.scss` | `#witness-glow` styles |
| `src/index.njk` | `#witness-glow` overlay element |

## Timestamp cleanup (also shipped)

All Firestore writes normalized to `new Date()` (was `Date.now()`). `tsToMs(ts)` helper added to all collection readers. Robert's `lastPracticedAt` in Firestore is still a legacy number — needs manual fix in FS console.

## Outstanding issues

**Design isn't landing yet.** The sequence plays but feels "a bit random" — the music, glow, and text don't cohere into something that feels intentional. Haven't had a real witness to test with (the only witness log in the DB was from a test account that got deleted).

**Needs real testing.** Frank hasn't actually witnessed Erik. Need a genuine witness event to validate the full flow end-to-end.

**Discoverability.** Frank may not have noticed the pulsing chime ring on the home screen. Worth a direct conversation with him — he might not know the gesture exists.

**Mock mode gap.** `?mockWitness` shows the regular witness queue (Ro'i, Yuki, Frank, Sarah) but no witnessed-by entry. Could add one to the mock queue for easier local testing.

## Design questions to revisit

- Does the Play/Skip mechanic feel right, or is it still too mechanical for what should be an intimate moment?
- Is the strings music + glow the right aesthetic, or does it need more visual grounding?
- Should the witnessed-by entry show the witness names upfront ("Frank witnessed you") rather than hiding them behind [Play]?
