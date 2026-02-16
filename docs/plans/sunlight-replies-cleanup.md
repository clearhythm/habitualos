# Sunlight Replies — Suggested Cleanup

Post-implementation recommendations for code quality and reuse. None of these are blocking — the feature works without them.

## Reuse opportunities

### 1. Reusable modal component (`modal.js`)
Created `src/assets/js/components/modal.js` for the sun points award modal. Currently only used there.

**Could replace:**
- Capture modal (hardcoded HTML in `chat.njk` lines 119-138)
- Survey modal (hardcoded HTML in `chat.njk` lines 140-160)
- History modal (built dynamically in `showHistoryModal()`)

**Benefit:** Single pattern, less inline HTML, consistent styling. Moderate effort.

### 2. Text animation utility (`text-animate.js`)
Created `src/assets/js/components/text-animate.js` for weather label transitions. Currently only used on the homepage.

**Could replace:**
- Thinking word cycle in `chat.njk` (lines 194-214, the `startThinkingCycle` function)
- Any future animated text transitions

**Benefit:** Removes ~20 lines from chat.njk, shared animation pattern. Low effort.

### 3. Pronoun system
Pronouns are defined in two places:
- `rely-chat-init.js` (full pronoun objects for system prompts)
- `chat.njk` (inline `{ 'Erik': 'he', 'Marta': 'she' }` for greeting)

**Could consolidate:** Move to a shared config or pass pronouns through the chat init response. Low priority since only two users exist.

### 4. Partner mapping
`PARTNERS = { 'Erik': 'Marta', 'Marta': 'Erik' }` is duplicated in:
- `rely-chat-init.js`
- `moment-reply-save.js`
- `chat.njk` (survey done handler)

**Could consolidate:** Create a shared `partners.cjs` config. Low effort, prevents drift.

## Data model notes

### Sun points singleton
The `sun-points/sun-current` doc stores per-person points as `erik` and `marta` (lowercase). If more users are added, this would need to shift to a sub-collection or dynamic key approach.

### Weather history
`weather/weather-current` stores a `history` array capped at 50 entries. If you want richer analytics (e.g., weekly trends), consider moving history to a sub-collection.

### Reply points idempotency
Points are only awarded on first reply to a moment (checked via `getReplyForMoment`). If you later allow "reply to reply" chains, the points logic will need revisiting — currently only the first reply doc per momentId is checked.

## Testing gaps

- No automated tests for sun points calculation or weather bonus tiers
- Weather auto-seed (on first `applyDelta`) should be verified manually: reply to a moment before the `weather-current` Firestore doc exists
- Daily points reset (todayDate check) crosses midnight boundary — worth a manual test
