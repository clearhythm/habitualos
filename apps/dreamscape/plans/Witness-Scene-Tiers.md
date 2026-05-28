# Witness Scene Tiers — Living Landscape

## Concept

The bottom half of the homepage holds a composable natural scene. It starts bare and grows richer as your circle witnesses you more. Witness count over the last 30 days determines your current tier. The scene is ambient — always present, never announced.

Day/night cycle is continuous, driven by the same time-of-day logic already used by the sky gradient and orb.

---

## Scene Layers (back to front)

```
sky           — existing gradient (setSkyGradient)
sun / moon    — rises/sets with time of day
stars         — night only, twinkle
mountains     — left and right, background
river/stream  — center, flows through the mountains
tree          — foreground, in front of one mountain, closer to viewer
birds / owl   — in the tree (day: birds, night: owl)
```

Elements are additive. Each tier unlocks the next layer. Removing witnesses never strips the scene mid-session — tier is read once on page load.

---

## Witness Tiers

| Tier | 30-day witness count | Scene elements added          | Sound added              |
|------|----------------------|-------------------------------|--------------------------|
| 0    | 0                    | (bare sky only)               | —                        |
| 1    | 1–3                  | Sun or moon                   | —                        |
| 2    | 4–10                 | Mountains (left + right)      | —                        |
| 3    | 11–25                | River / stream                | River ambient loop       |
| 4    | 26–50                | Tree (foreground)             | —                        |
| 5    | 51+                  | Birds in tree                 | Day birds or owl (night) |

---

## Time of Day Behavior

**Daytime**
- Sun arc across the sky (position interpolated from hour)
- Day birds audible (ambient chirping loop) at Tier 5

**Nighttime**
- Moon + stars (stars twinkle — CSS animation or subtle opacity pulse)
- Owl replaces day birds at Tier 5

Transition hours (dawn/dusk) are already tracked by `setSkyGradient` — scene elements can key off the same `hour` value.

---

## Audio Layer

Sound is additive across tiers. Each layer plays as an ambient loop through `audio-engine.js`:

- **River** (Tier 3+): soft water/stream loop, low volume, always on
- **Day birds** (Tier 5, daytime): ambient chirping loop
- **Owl** (Tier 5, nighttime): occasional owl call, sparse and atmospheric

These plug into the existing ambient-player system. Files TBD — same approach as the windchime and bird-chirp effects.

---

## Visual Implementation

Scene elements live in a new `.scene-backdrop` div inside `.blossom-scene`, positioned behind `.blossom-content`. SVG or CSS-painted layers, composited with `position: absolute`.

The tree is notably in the foreground — larger, slightly overlapping the scene composition. It should feel like you're standing at the edge of a valley looking in.

```
.blossom-scene
  .scene-backdrop           ← new: composited layers
    .scene-sky              ← existing gradient (move here or mirror)
    .scene-celestial        ← sun / moon / stars
    .scene-mountains        ← left + right silhouettes
    .scene-river            ← center flowing element
    .scene-tree             ← foreground, left or right of center
  .blossom-content          ← chime + actions (unchanged)
```

Each layer is conditionally rendered based on tier class on `.scene-backdrop`:

```js
document.querySelector('.scene-backdrop')?.dataset.tier = String(tier); // '0'–'5'
```

CSS shows/hides layers by `[data-tier]` value.

---

## Backend

Requires witness count for the authenticated user over the last 30 days.

**Option A**: Extend the `witness-count.cjs` function planned in Witness-Sounds-Ticket1 Part 2 to accept a `window=30d` param.

**Option B**: Read directly from Firestore `witnesses/` collection on load, queried by `witnessedUserId` + `createdAt > 30 days ago`.

Count is fetched once at init, tier computed client-side, scene rendered before first paint where possible.

---

## What Does NOT Change

- The chime, wind-chime SVG, and all homepage action buttons — untouched
- `blossom-content` layout — unchanged
- Sky gradient — reused, not replaced
- The witness action itself (chime echo on tap) — separate from this

---

## Verification

1. 0 witnesses → bare sky, no scene elements
2. 3 witnesses → sun or moon appears at correct position for time of day
3. 10 witnesses → mountains visible left + right
4. 20 witnesses → river/stream appears, river ambient sound begins
5. 40 witnesses → tree appears in foreground
6. 60 witnesses → birds in tree (day) / owl (night), ambient audio plays
7. Night visit → moon + stars, owl if Tier 5
8. Day visit → sun arc, day birds if Tier 5
9. Scene does not change mid-session if witness count increases while on page
