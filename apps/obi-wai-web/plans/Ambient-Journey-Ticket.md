# Flower Avatars + Community Garden

Replaces the abstract SVG landscape concept. The ambient storytelling is simpler and more concrete: each person in the community IS a flower. The garden page shows your whole circle blooming together. Practice activity affects the visual state of each flower.

Depends on: Community Feed Tickets 1–3 (linked users, reactions, feed UI).

---

## Concept

- Each user has a flower avatar — randomly assigned at signup, cycleable on the Account page
- The community feed shows flower avatars instead of initials
- The Garden page (`/practice/garden/`) becomes a living view of your circle: each person's flower, their last practice, and a visual state (blooming vs. quiet)
- Your own flower is also shown — it's yours in the garden alongside everyone else's

**Ambient storytelling**: you open the app and see a garden. Some flowers are fully bloomed (practiced today). Some are quieter. No streaks, no scores — just a garden and who's been tending it.

---

## Avatar System

### Images
- 20–30 pre-sourced flower images stored in `src/assets/images/flowers/`
- Naming: `flower-01.png` through `flower-N.png` (or `.webp` if available)
- Manifest: `src/assets/js/utils/flowers.js` — exports an array of flower IDs

```js
// flowers.js
export const FLOWERS = [
  'flower-01', 'flower-02', 'flower-03', /* ... */
];
export function randomFlower() {
  return FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
}
export function flowerSrc(id) {
  return `/assets/images/flowers/${id}.png`;
}
```

### Assignment
- On first sign-in (new user): assign `randomFlower()`, save to `profile.avatarId` via `user-profile-set.js`
- On Account page: show current flower, "← →" arrows to cycle through all options, save on change (or auto-save on cycle)
- Migration: existing users without `profile.avatarId` get assigned a random one on next page load (client-side, saved immediately)

### User doc addition
```js
profile.avatarId: 'flower-07'
```

---

## Garden Page (`/practice/garden/`)

Currently exists but shows practice habits. Replace with:

### Layout
A visual garden of flower cards — your circle (linked users + yourself), each represented by their flower.

```
┌─────────────────────────────────────┐
│  🌸  Frank                          │
│      Practiced · 2 hours ago        │
│      [👁 I see you]                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🌻  You                            │
│      Practiced · this morning       │
│      3 people have witnessed you    │
└─────────────────────────────────────┘
```

### Visual state
- **Practiced today**: flower image at full opacity, subtle glow/bloom ring
- **Practiced in last 3 days**: flower at full opacity, no ring
- **Not practiced in 3+ days**: flower at reduced opacity (0.5), grayscale filter
- No streaks, no numbers — just a visual "is this garden being tended"

### Data
Fetched from the same `community-feed` endpoint (already returns circle entries). Garden page uses the same data, different render.

---

## Community Feed Updates (feed uses flower avatars)

In Community Feed Ticket 3:
- Replace the initials/letter avatar on feed entries with the flower image
- `<img src="/assets/images/flowers/${entry.avatarId}.png" ...>`
- `community-feed.js` should return `avatarId` from each user's profile

---

## Account Page Updates

Add avatar selector to `src/profile.njk`:
- Shows current flower at ~80px
- Left/right arrow buttons to cycle
- Updates saved to `profile.avatarId` via `user-profile-set.js`
- On first load, if no avatarId, assign random and save immediately

---

## Backend

### `user-profile-set.js` (already updated in Ticket 1)
Accept `avatarId` in addition to `displayName` and `phoneNumber`.

### `community-feed.js`
Return `avatarId` alongside `displayName` in each entry's user data.

---

## Files

| Action | File |
|--------|------|
| new    | `src/assets/images/flowers/` (drop-in from sourced assets) |
| new    | `src/assets/js/utils/flowers.js` |
| modify | `src/practice/garden.njk` — new garden layout |
| modify | `src/assets/js/pages/practice-garden.js` — fetch circle, render flowers |
| modify | `src/profile.njk` — add avatar selector |
| modify | `src/assets/js/pages/profile.js` — load/save avatarId, cycle UI |
| modify | `netlify/functions/community-feed.js` — return avatarId |
| modify | `netlify/functions/user-profile-set.js` — accept avatarId |

---

## Verification

1. New user signs in → gets a random flower assigned to `profile.avatarId`
2. Account page shows the flower, arrows cycle through all options, saves on change
3. Garden page shows circle's flowers — Frank's flower + your flower
4. Frank practiced today → his flower is fully bloomed; you haven't → yours is muted
5. Community feed entries show flower avatars
6. Existing user with no avatarId → gets randomly assigned on next page load
