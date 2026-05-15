# Ambient Journey — Collective Progress Visualization

A shared animated landscape that advances based on cumulative check-ins from your circle. Non-judgmental, non-competitive. The point isn't how fast you move — it's that you're moving together.

Depends on: Brand Redesign Ticket (visual language), Community Feed Ticket 1 (practice logs + linked users).

---

## Concept

Everyone travels through the same narrative landscape, but at their own pace determined by their circle's total check-ins. A circle of 3 people with 4 collective check-ins today is further along than a circle of 2 with 1 check-in. Progress is cumulative — it never goes backwards.

**Journey chapters (example sequence):**
1. Base of a mountain (0–20 check-ins)
2. Climbing the mountain (20–50)
3. Summit — wide open sky (50–100)
4. Flying on a giant bird (100–175)
5. Bird descends into a forest (175–275)
6. Walking through the forest (275–400)
7. Emerge at the ocean (400–550)
8. Swimming with a whale (550–750)
9. Arrive at Atlantis (750+)

Thresholds are tunable. For a circle of 4 people checking in twice daily (~8/day), 20 check-ins ≈ 2–3 days. Each chapter ≈ a week or more of consistent community practice.

**Replay mode**: A scrubber that lets you "rewind" and watch the journey advance — each tick represents a check-in, attributed to a circle member. A way to witness the collective history.

---

## Progress Mechanic

- **Position** = total check-ins from `profile.linkedUserIds` + own check-ins, since account creation (or since feature launch)
- Fetched from the same practice logs already stored per user
- Backend: new field or computed on-the-fly — sum of `allLogs.length` for self + each linked user
- Each user sees their own position (not a shared global counter)

---

## V1 Approach — Abstract SVG Paths

No detailed artwork needed in V1. The feeling of movement matters more than illustration quality.

**Visual approach:**
- SVG scene: landscape silhouettes (mountain profile, treeline, ocean horizon) — simple paths, no detailed illustration
- A small marker (dot or minimal person figure) animates along a bezier path through the scene
- Scene transitions: fade/dissolve when chapter threshold is crossed
- Color palette: dark forest green from the brand redesign — scenes use the same palette

**Scene rendering:**
- Each chapter is an SVG component with: background layer, path layer, foreground layer
- The marker position = `(currentCheckIns - chapterStart) / (chapterEnd - chapterStart)` → `[0, 1]` progress along the SVG path
- CSS `offset-path` + `offset-distance` for smooth marker movement along the path

**What the user sees on the homepage:**
- The current scene replaces the March Challenge widget (below the Motivate/Log cards)
- Chapter label: "Day 8 · Climbing the mountain"
- Small byline: "3 people · 47 check-ins"
- Tap/click → full-screen journey view with replay scrubber

---

## V2 Approach — Commissioned Illustrations

Once the mechanic is proven with abstract SVGs, replace each chapter's background with a commissioned hand-drawn illustration. 9 chapters = 9 illustrations. Style: thin-line botanical, organic, consistent with the brand palette.

---

## Backend

### New field: cumulative check-in count

Option A: Computed on-the-fly in `community-feed.js` (already fetches all logs for self + circle) — add `circleCheckInTotal` to the response. No new storage.

Option B: Increment a `profile.circleCheckInCount` field each time anyone in the circle logs. More complex, but O(1) read instead of sum.

**Recommendation**: Option A for V1. Revisit if performance is an issue.

### Response addition to `community-feed.js`
```js
circleCheckInTotal: number  // sum of log counts for self + all linkedUserIds
```

---

## Frontend

### `src/assets/js/pages/practice-index.js`
- Render the journey widget below the Motivate/Log cards
- Fetch `circleCheckInTotal` from community-feed response
- Determine current chapter + position within chapter
- Render SVG scene with animated marker
- Tap → open full-screen journey overlay

### `src/assets/js/utils/journey.js` (new)
- `getChapter(total)` → returns `{ name, start, end, svgScene }`
- `getProgress(total)` → `[0, 1]` within current chapter
- Chapter definitions array (thresholds, labels, scene IDs)

### `src/assets/svg/journey/` (new directory)
- `mountain-base.svg`, `mountain-climb.svg`, `summit.svg`, `bird-flight.svg`, `forest.svg`, `ocean.svg`, `whale.svg`, `atlantis.svg`
- V1: abstract silhouettes. V2: replace with illustrations.

### Full-screen overlay
- Opens from the widget
- Shows the current scene full-screen
- Progress bar showing position in current chapter
- Chapter label + circle stats
- Replay scrubber: drag to scrub through history, each step shows whose check-in it was

---

## Verification

1. Create 3 test accounts, link them, add 15 check-ins across the group
2. Homepage shows mountain scene, marker positioned at ~75% along the path
3. Add 5 more check-ins → crosses 20 threshold → scene transitions to "Climbing" chapter
4. Open full-screen view → replay scrubber shows each check-in attributed to a person
5. Two unconnected users with different circle sizes show different positions
6. Page loads fast — SVG scenes are inline or cached, no blocking requests

---

## Open Questions

- Does the journey advance in real-time (WebSocket/SSE) or only on page load? For V1: page load only.
- Do you want to "name" the chapters or keep them wordless (just visual)?
- Should check-ins before the feature launched count toward position, or start fresh?
