# Witness Sounds — Ticket 1: Chime Echo on Witness

## Status: DONE

## What Was Built

When a user taps **Witness** on a friend's practice session, the friend's own chime signature plays back as a soft echo — same notes, one octave up, lower gain, long fade tail.

This replaced the originally-planned bird call. The chime echo is conceptually tighter: you're resonating the friend's own sound back, not introducing a new instrument.

### Implementation (`home.js`)

```js
function playWitnessEcho(sig) {
  // Plays friend's chime: +12 semitones (octave up), 0.35 gain, ~10s fade
  // Lingers beneath the next session's chime as the queue advances
}
```

Called from the witness button handler alongside `swingChime()`. The witness advance delay is 2500ms — enough for the echo to bloom before the queue moves.

The advance timer is stored in `_queueTimer` so a manual chime click immediately cancels it (prevents double-advance / double-chime race condition).

---

## What Was NOT Built (Superseded)

The original ticket also included **N bird calls on practice return** — playing bird sounds when you return home and have been witnessed since your last session.

This concept has been superseded by **Witness-Scene-Tiers.md**, which is a richer approach: instead of a transient N-call playback, your witness count over 30 days grows a persistent living scene (mountains, river, tree, birds, owl). The return experience is ambient rather than event-driven.

See `plans/Witness-Scene-Tiers.md` for the full spec.
