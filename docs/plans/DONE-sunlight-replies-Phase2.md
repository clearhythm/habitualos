# Sunlight Replies — Phase 2: Sun Points + Award Celebration

**Goal**: Replies now award sun points. Both people earn points. A celebratory modal shows the award. Points tracked per-person.

## Data model

```
Collection: sun-points (singleton)
{
  id: "sun-current",
  erik: 0,
  marta: 0,
  totalPoints: 0,
  todayPoints: 0,
  todayDate: "2026-02-15",
  lastAwarded: null,
  lastUpdated: "2026-02-15T..."
}
```

Add `sunPoints` field to `moment-replies` docs.

## Scoring

| Moment type | Points per person |
|-------------|-------------------|
| Happy | +5 |
| Sad | +5 |
| Hard | +10 (+5 base + 5 courage) |

Only first reply to a moment awards points.

## Steps

### 1. Create `db-sun-points.cjs` service
- `getCurrentPoints()` → reads singleton
- `addPoints({ replierName, sharerName, points })` → updates per-person + total + today
- `getTodayPoints()` → for temp bonus tier calculation (Phase 3)
- Path: `apps/relationship-web/netlify/functions/_services/db-sun-points.cjs`

### 2. Create `sun-points-current.js` GET endpoint
- Returns: `{ totalPoints, erik, marta }`
- Path: `apps/relationship-web/netlify/functions/sun-points-current.js`

### 3. Update `moment-reply-save.js` to award points
- After saving reply: determine points by moment type
- Call `db-sun-points.addPoints()`
- Store `sunPoints` on the reply doc
- Return: `{ success, replyId, sunPoints }`

### 4. Create reusable modal component
- Extract modal pattern from existing capture/survey modals into `modal.js`
- `createModal({ id, emoji, title, subtitle, contentHtml, confirmLabel, dismissLabel })`
- Returns `{ show(), hide(), confirmBtn, dismissBtn, contentEl }`
- Refactor capture + survey modals to use it
- Path: `apps/relationship-web/src/assets/js/components/modal.js`

### 5. Add sun points award modal
- After SEND_REPLY saves successfully, show modal:
  - Emoji: sun
  - Title: "+10 - Reply sent!"
  - Subtitle: "You both earned sun points for showing up."
  - Confirm: "Nice" → navigates to `/`
- Update reply display on moment cards to include points: "+10 - Erik replied Feb 13"

## Key files to modify
- `apps/relationship-web/netlify/functions/moment-reply-save.js` — add points logic
- `apps/relationship-web/src/chat.njk` — refactor modals + add sun points modal
- `apps/relationship-web/src/index.njk` — show points in reply display
- `apps/relationship-web/src/moments.njk` — show points in reply display

## Verification
1. Reply to a hard moment → modal shows "+10 - Reply sent!"
2. Reply to a happy moment → modal shows "+5 - Reply sent!"
3. Check Firestore: sun-current doc has correct per-person and total points
4. Reply display on cards shows "+10 - Erik replied..."
5. Second reply to same moment → no additional points (but reply still saves)
