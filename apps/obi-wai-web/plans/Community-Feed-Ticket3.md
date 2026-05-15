# Community Feed — Ticket 3: Feed UI + Community Page

Replace the March Challenge widget with the Community Feed, add the Community page, update nav and account page. Depends on Tickets 1 and 2.

## Files

- `src/practice/index.njk` — replace March Challenge HTML block with `#community-feed-block` container (hidden until loaded)
- `src/assets/js/pages/practice-index.js` — remove all challenge/calendar code; add feed loading + rendering + reaction handling
- `src/community.njk` + `src/assets/js/pages/community.js` (new) — `/community/` page, three sections
- `src/profile.njk` — add `displayName` input at top, de-emphasize phone
- `src/assets/js/pages/profile.js` — load/save `displayName`
- `src/_includes/nav.njk` — add Community link, rename Profile → Account

## Feed card design

```
Frank practiced · 2 hours ago

[👁 I see you · 1]  [🤝 I'm with you]
[🌱 Keep going]     [📝 Note]

Erik: "With you on this one."
```

Own entry (no reaction buttons):
```
You practiced · 5 hours ago

👁 Frank sees you  🤝 1
Frank: "Nice work getting out."
```

Privacy: practice name, duration, and reflection are NEVER shown. Only who + when.

## practice-index.js changes

```js
// Cache key
const FEED_CACHE_KEY = 'obi_community_feed_cache';

async function loadCommunityFeed() {
  // 1. Check cache (localStorage), render immediately if fresh (<5min)
  // 2. Fetch /api/community-feed?userId=...&limit=20
  // 3. Fire-and-forget: POST /api/community-feed-record-witness { viewerUserId, practiceIds }
  // 4. Render, update cache
}

function renderFeed(entries) {
  // Render entry cards — "Frank practiced · 2 hours ago" format
  // Show reactions below each card
  // Own entries: no reaction buttons, show received reactions
}

async function handleReact(practiceId, type) {
  // Optimistic toggle in UI
  // POST /api/community-react { fromUserId, practiceId, type }
  // On error: revert
}

async function handleNote(practiceId) {
  // Expand inline textarea on "Note" tap
  // POST /api/community-react { fromUserId, practiceId, type: 'note', content }
  // Append note to card on success
}
```

## Community page sections (`community.js`)

1. **Your circle** — fetch from community-feed response (unique linked users), show display name + last practice date ("Frank · practiced 2 hours ago")
2. **Your link** — construct `https://practice.habitualos.com/connect/?id=[userId]`, show with copy button
3. **Invite someone new** — email input, POST to `/api/community-invite-send`, show success/error inline

## joined banner

On `/practice/?joined=1`: show dismissable banner "You're now connected" at top of feed.
On `/practice/?already-connected=1`: show "Already in your circle."

## Test

1. Frank practices → entry appears in Erik's feed as "Frank practiced · X hours ago"
2. Erik taps "I see you" → count shows 1, button highlighted; tap again → removed
3. Erik adds note via inline textarea → note appears below card
4. Witness count increments silently in background on feed load (verify in Firestore)
5. `/community/` shows Frank in Your circle, Erik's connect link with copy button, invite form
6. `/practice/?joined=1` shows banner
7. Nav shows "Community" link, "Profile" renamed to "Account"
