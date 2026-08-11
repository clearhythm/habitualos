# Ticket 5: two-pass fact coverage (Basics → Complete) on the Menu drill

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket is a full rewrite of the original Ticket 5 draft, which was written
against a `/learn/` page with a picker → teach → drill three-phase flow
that no longer exists. By the time this ticket was actually implemented,
`/learn/` had already been folded into `/menu/` (a Review/Practice toggle
on one category-detail page — see the commits "fold /learn/ into /menu/"
and "fetch + cache /menu/ content client-side"), and menu content had
moved from build-time-baked to fetched-on-demand + client-cached. The
rewrite was re-derived directly against the live code rather than patching
the stale draft.

**Goal, unchanged from the original draft's intent**: each menu section
has two gated drill passes — **Basics** (ingredients only) then
**Complete** (dietary + pricing) — because reviewing a section's full
description/price/tags at once, then being quizzed on any of it, was
overwhelming even for a strong-memorization user, and the real target
audience (staff studying between shifts) would find it worse. Which pass a
section is in is derived from coverage data every turn, never stored
separately. Firestore is authoritative; localStorage is a cache that gets
reconciled against it, not trusted forever — a cleared browser or a
different device recovers real progress instead of looking reset.

## Key decisions

- **Item ids**: menu item ids never reached the client before this ticket
  — `db-restaurants.cjs`'s `buildCategoryList` stripped `item._id`. Fixed
  by exposing it as `id` in the trimmed item shape (feeds both the prompt
  and `/api/restaurant-menu-get`).
- **Tier vocabulary**: blank (not started) → **Training** → **Mastered**.
  Menu's own ceiling for this drill — not a claim on the separate cross-app
  4-dot skill-tree scale (`practice.njk`), which may get simplified
  separately.
- **Browse-list pill** (right-aligned on the category row): two states
  only, kept quiet on purpose. **Training** shows only on the single
  most-recently-entered-Practice section (a "where was I" pointer, not a
  general any-progress flag) provided it isn't yet Mastered. **Mastered**
  shows once every item has both passes fully covered. Otherwise blank —
  no pill for "some other section has partial progress."
- **Basics → Complete transition**: finishing every item's ingredients in
  Practice disables input and appends an inline celebration banner in the
  transcript with a Continue button. Continue flips the toggle to Review,
  where price/dietary are now bold and description is muted (the inverse
  of Basics) — a deliberate "look again with fresh eyes" moment before
  being quizzed on the new fields — then Practice resumes the same
  conversation, Complete-pass only.
- **Tool removed**: the old `mark_section_learned` tool-call (one
  whole-section boolean, model self-graded) is gone, replaced by an
  `ITEM:`/`FACT_TYPE:`/`RESULT:` line-marker convention — deterministic,
  per-item-per-fact-type, computed client-side from the stream.
- **`learn-progress` id scheme**: one Firestore doc per **(user,
  restaurant)** pair, not one doc per user with restaurant as a nested
  object key. Doc id is **deterministic**, not randomly generated —
  `lp-{userId minus its u- prefix}-{restaurantId}` (computed by
  `progressId()` in `db-learn-progress.cjs`). Went through a randomly-
  generated `lp-{unique}` + query-by-`_userId`-then-filter phase first
  (matching `learn-chats`' pattern) before landing here once it was clear
  the natural key is always known upfront — unlike a chat session's id,
  which the client has to remember across saves, `(userId, restaurantId)`
  is stable and available on every call, so there's nothing to query for.
  This means every write/read is a direct `get`/`create` by known id —
  no query, and `db-core.create()`'s own create-if-new/merge-if-exists
  behavior (a real `.get().exists` check on that specific doc reference,
  every call) handles new-vs-existing correctly without a separate check.
  Fields: `_progressId` (mirrors the doc id — still useful even though
  it's derivable, e.g. if the doc is ever read without its id metadata),
  `_userId`, `_restaurantId`, `sections`.
  - **Accepted trade-offs**: (1) if `restaurantId` values were ever
    rekeyed, every `learn-progress` doc's id would go stale — but
    `restaurantId` is already the primary doc id for `restaurants` and
    `restaurant-menus`, the more foundational collections, so a rekey
    would already force recreating those regardless; migrating
    `learn-progress` alongside them is a small addition to an
    already-necessary migration, not a new one. (2) the id no longer
    carries a fresh timestamp for *this record's* own creation (unlike
    `uniqueId()`'s ids), so it doesn't sort chronologically by creation
    time in the Firestore console — what it gains instead is that every
    one of a user's `learn-progress` docs shares the same prefix and
    sorts adjacent to each other, grouped by user rather than scattered
    by creation time.
  - `generateProgressId()` (the old random-id generator, in
    `_utils/data-utils.cjs`) was removed once nothing called it anymore.
- **`_lastTrained`** (the Training-pill pointer) lives *inside* `sections`
  as a sibling key to section names, not as a top-level doc field — it's
  semantically about the section it points into, and sorts visually
  adjacent to the section list in the Firestore console (same
  underscore-metadata-sorts-first convention, one level deeper).
  `getLearnProgress` destructures it back out before returning, so no
  downstream caller ever has to filter it out of `sections` itself.
- **Client-side file boundaries** (settled mid-implementation, not in the
  original plan): `menu-restaurant-filter.js` owns layout/rendering/
  filtering only (browse/detail phases, the restaurant switcher, the
  browse-list pills) — it does not contain drill logic. The Practice
  experience (streaming, marker parsing, fact coverage, transitions, chat
  persistence, the correction flow) is a separate module,
  `learn-practice.js`, which `menu-restaurant-filter.js` calls into
  (`startPractice`/`exitPractice`/`hasActiveSession`) rather than
  containing inline. The two communicate one-directionally — only
  `menu-restaurant-filter.js` imports `learn-practice.js`, never the
  reverse — via three callbacks passed into `startPractice`
  (`onSessionStarted`, `onCoverageChanged`, `onTransitionToReview`).
  `learn-coverage.js` (the tier/pass arithmetic + cache/reconcile logic)
  is page/feature logic, not a cross-cutting utility, so it lives
  alongside the other page scripts, not under `utils/`.

## Files

**Shared core**
- `packages/edge-functions/chat-stream-core.ts` (+ synced copy at
  `apps/tico-talk/netlify/edge-functions/_lib/chat-stream-core.ts`) —
  `factCoverage` added to `RequestBody`/`initBody`.
- `netlify/edge-functions/chat-stream.ts` — `learn`'s `toolExecuteEndpoint`
  is now `null` (no tools left).

**Backend**
- `netlify/functions/_services/db-restaurants.cjs` — exposes `item.id`.
- `netlify/functions/_services/db-learn-progress.cjs` — rewritten around
  the `lp-` per-(user, restaurant) schema above.
- `netlify/functions/_utils/data-utils.cjs` (NEW) — `generateChatId()`/
  `generateProgressId()`, the one place server-side id prefixes live.
- `netlify/functions/learn-progress-write.cjs` (NEW) — one write endpoint
  for the resource (`itemId`+`factType` and/or `lastTrained`), not one
  endpoint per field — matches `learn-chats`' get/save shape.
- `netlify/functions/learn-progress-get.cjs` (NEW) — reads
  `{sections, lastTrained}` for one restaurant.
- `netlify/functions/learn-tool-execute.cjs` — deleted.
- `netlify/functions/learn-chat-init.cjs` — rewritten: pass-aware
  `buildSectionPrompt`, uncached `buildCoveragePrompt`, the
  `TICO:/GUEST:/ITEM:/FACT_TYPE:/RESULT:` format, `tools: []`.

**Client**
- `src/assets/js/menu-restaurant-filter.js` — rendering/filter/browse only
  (see file boundaries above); computes/refreshes browse-list pills, the
  Train-link target, and the Review panel's initial `data-pass`.
- `src/assets/js/learn-practice.js` (NEW) — the Practice chat: marker
  parsing (5 markers now, `SEGMENT_MARKER_HOLDBACK` 10), fact-coverage
  tracking, the pass-transition/Mastered banners, per-section chat
  persistence, the flag-and-confirm correction flow.
- `src/assets/js/learn-coverage.js` (NEW, not under `utils/`) — cache/
  reconcile logic (`hydrateSectionCoverage`, `hydrateRestaurantProgress`)
  and the tier/pass arithmetic (`passForSection`, `isSectionMastered`,
  `tierForSection`, `computeTierBySection`, `tierForSectionInProgress`).
- `src/assets/js/collections/learn-progress.js` (NEW) — thin CRUD
  (`getLearnProgress`/`writeLearnProgress`), no caching or derived logic,
  matching `collections/learn-chats.js`'s shape.
- `src/assets/js/utils/data-utils.js` (renamed from `utils/id.js`) —
  `generateChatId()` added; `menu-restaurant-filter.js`'s old inline
  duplicate removed.
- `src/assets/js/learned-sections.js` — deleted (superseded by
  `learn-coverage.js`'s per-item-per-fact-type tracking).

**Templates & styles**
- `src/menu.njk` — progress bar markup added inside `#menu-practice`.
- `src/styles/_learn.scss` — progress bar, pass-transition banner, and
  the `.menu-detail__review[data-pass]` highlight selectors.
- `src/styles/_menu-review.scss` — `.menu-category__header` (wraps the
  category name + pill on one row) and `.menu-category__pill` variants.

**Not touched, deliberately**: `menu-categories.njk` and `/menu-review/`
are orphaned (unlinked, untouched since before the `/menu/` rewrite) but
`/menu-review/`'s own concept (review extracted menu JSON before it
becomes THE menu) is still valid, just not built yet — out of scope here.

## Verification

1. `node --check` on every new/modified `.cjs` file — done, all pass.
2. Full `pnpm`/`npm run build` (SCSS + Vite bundle) — done, passes clean.
3. Not yet done: end-to-end exercise via `netlify dev` with
   `ANTHROPIC_API_KEY` set —
   - Fresh section's Practice: price/tags muted, description bold
     (`data-pass="basics"`); drill only asks ingredient questions even if
     volunteered otherwise; `ITEM:`/`FACT_TYPE:`/`RESULT:` never leak into
     the visible transcript.
   - Finish every item's ingredients: input disables, transition banner
     fires exactly once, Continue flips to Review with price/tags now
     bold, Practice resumes the same conversation asking only
     dietary/pricing.
   - Finish dietary + pricing: Mastered banner fires, the matching
     `learn-progress/{lp-...}` doc in Firestore (found by
     `_userId`/`_restaurantId`) shows `sections` → section → item → all
     three fact types `true`, and the browse pill flips to Mastered.
   - Enter Practice for a different section without finishing the first:
     confirm the Training pill moves, doesn't linger on the old section.
   - Reload mid-Basics and mid-Complete: progress bar/pass resume
     correctly.
   - Restaurant isolation: Mastered progress at one restaurant doesn't
     leak into a same-named section at another.
   - Clear localStorage mid-drill, reload: progress bar recovers from
     Firestore, doesn't reset to zero.
   - Cache check (with a real API key): `cache_read_input_tokens` shows
     reads turn 2+ within one pass; a pass boundary is an expected,
     acceptable miss on the section block.
