# Tour + Scene Sounds — Ticket 1: Nature Sound Engine

## App Context

Dreamscape (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS modules. No `console.log` — use `log()` from `src/assets/js/utils/log.js`. Dark mode only.

**Local dev:** `npm run dev` from `apps/dreamscape/` (http://localhost:8889).

**Key files to read first:**
- `src/assets/js/pages/home.js` — full file. Understand: `_audioCtx`, `_chimeBuffer`, `_muted`, `_volume`, `playSignature()`, and the async IIFE that initializes audio.
- `src/assets/music/ambient/` — directory already exists; sound files go here.

---

## What This Ticket Builds

A shared nature sound engine: time-of-day selection, pitch-variation playback, and preloading. This is the **foundation** consumed by:
- **Ticket 2** — Welcome tour (each slide advance plays a nature sound)
- **Future ticket** — Feed passive advance (each friend's entry plays a nature sound)

Build it here as a self-contained module. Do not wire it to the feed yet.

---

## Concept

Same audio pattern as `playSignature()` but for nature sounds:
- Select a base sample based on time of day (bird or owl)
- Play it 1–3 times with randomized timing and slight pitch variation between hits
- Each call sounds natural and slightly different — never mechanical

The owl at night: "whoo... whoo whoo." The bird at midday: three quick chirps, slightly different pitches. Same logic, different base samples.

---

## Sound Files

Place in `src/assets/music/ambient/`. Short clips, non-looping, mono or stereo .mp3. One clean isolated hit per file — no reverb tails longer than 1s. Sources: freesound.org (CC0), Pixabay, or recorded.

| File | Scene | Character |
|---|---|---|
| `bird-day.mp3` | Daytime (6–20) | Single clean bird chirp/tweet |
| `owl-night.mp3` | Night (21–5) | Single clean owl "whoo" |

v1 uses two files. Future tickets add more (dawn chorus, evening frogs, etc.) using the same engine.

---

## Data Model

```javascript
// src/assets/js/pages/home.js (or extracted to scene-sounds.js if preferred)

const SCENE_FRAMES = [
  { from:  0, to:  6, sound: 'owl-night.mp3',  baseVolume: 0.40 },
  { from:  6, to: 21, sound: 'bird-day.mp3',   baseVolume: 0.55 },
  { from: 21, to: 24, sound: 'owl-night.mp3',  baseVolume: 0.40 },
];

function getSceneFrame() {
  const h = new Date().getHours();
  return SCENE_FRAMES.find(f => h >= f.from && h < f.to) ?? SCENE_FRAMES[1];
}
```

Expand `SCENE_FRAMES` in future tickets by adding more rows with narrower hour ranges. Existing callers are unaffected.

---

## Implementation

### Preload

Add to the existing async IIFE in `home.js` (after `_audioCtx` is created, alongside `_chimeBuffer` fetch):

```javascript
const _sceneSoundBuffers = {};

async function preloadSceneSounds() {
  const files = [...new Set(SCENE_FRAMES.map(f => f.sound))];
  for (const file of files) {
    try {
      const ab = await fetch(`/assets/music/ambient/${file}`).then(r => r.arrayBuffer());
      _sceneSoundBuffers[file] = await _audioCtx.decodeAudioData(ab);
      log('debug', '[scene] preloaded:', file);
    } catch (e) {
      log('warn', '[scene] failed to preload:', file, e);
    }
  }
}
```

Call `preloadSceneSounds()` inside the existing IIFE after `_chimeBuffer` is loaded.

### Playback

```javascript
function playSceneSound() {
  if (_muted || !_audioCtx || _audioCtx.state !== 'running') return;
  const frame = getSceneFrame();
  const buffer = _sceneSoundBuffers[frame.sound];
  if (!buffer) { log('warn', '[scene] buffer not ready:', frame.sound); return; }

  // 1–3 hits, randomised timing and slight pitch variation
  const count = Math.floor(Math.random() * 3) + 1;
  const masterGain = _audioCtx.createGain();
  masterGain.gain.value = frame.baseVolume * _volume;
  masterGain.connect(_audioCtx.destination);

  let offset = 0;
  for (let i = 0; i < count; i++) {
    const source = _audioCtx.createBufferSource();
    source.buffer = buffer;
    // slight pitch variation ±6% per hit
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.12;
    source.connect(masterGain);
    source.start(_audioCtx.currentTime + offset);
    offset += 0.18 + Math.random() * 0.28; // 180–460ms between hits
  }

  log('debug', '[scene] played', frame.sound, 'x', count, 'hits');
}
```

### Export

`playSceneSound()` is the single public function. Other modules (tour, feed) call it directly. No parameters needed — it reads the current time internally.

---

## What Does NOT Change

- `playSignature()` — untouched
- `MOCK_SESSIONS` — untouched
- Chime loop timing — untouched
- Nothing calls `playSceneSound()` yet — wired in Ticket 2 and the future feed ticket

---

## Verification

1. Preload logs appear in console on page load: `[scene] preloaded: bird-day.mp3`, `[scene] preloaded: owl-night.mp3`
2. Call `playSceneSound()` in the browser console — sound plays.
3. Call it 5 times rapidly — each plays a different number of hits (1–3) with slightly different pitches.
4. Set `_muted = true` in console, call again — nothing plays, warn not triggered.
5. Remove sound files (or rename) — `[scene] failed to preload:` warning logged, page does not throw.
6. Between 6:00–20:59: bird plays. Between 21:00–5:59: owl plays.
