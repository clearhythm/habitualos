# Ticket 5: two-pass fact coverage (Basics → Complete) on the Menu drill

**DONE.** Corrected below (2026-08-17) against the actual live code — a
few specifics drifted from this doc as the implementation evolved past
it (most notably: the tool call was never removed, and there's no
progress bar). Left as historical record of the decisions made, not
current-state documentation to trust blindly for anything not corrected
here.

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
- **Tier vocabulary** (CORRECTED — three states, not two): blank (not
  started) → **Training** → **Covered** → **Mastered**. Covered was added
  during implementation: full coverage on a section reads differently the
  first time you get through it (Covered — plain colored text) versus
  having actually retained it over time (Mastered — solid pill). Menu's
  own ceiling for this drill — not a claim on the separate cross-app
  4-dot skill-tree scale (`practice.njk`), which may get simplified
  separately. **Mastered's real mechanic (earned via repeated correct
  Review passes over time) is still NOT built** — the tier and its
  styling exist, but nothing currently promotes a section from Covered to
  Mastered. Everything that reaches full coverage today tops out at
  Covered.
- **Browse-list pill** (right-aligned on the category row), CORRECTED to
  match the three states above. **Training** shows only on the single
  most-recently-entered-Practice section (a "where was I" pointer, not a
  general any-progress flag) provided it isn't yet Covered/Mastered.
  **Covered**/**Mastered** show once earned, per the tier vocabulary
  above. Otherwise blank — no pill for "some other section has partial
  progress."
- **Basics → Complete transition**: finishing every item's ingredients in
  Practice disables input and appends an inline celebration banner in the
  transcript with a Continue button. Continue flips the toggle to Review,
  where price/dietary are now bold and description is muted (the inverse
  of Basics) — a deliberate "look again with fresh eyes" moment before
  being quizzed on the new fields — then Practice resumes the same
  conversation, Complete-pass only.
- **Tool call kept, redesigned (CORRECTED — this plan originally intended
  to remove it entirely; that didn't happen and the replacement described
  below was never built)**: the old `mark_section_learned` tool-call (one
  whole-section boolean, model self-graded) is gone, but it was replaced
  by a *new* tool, `record_fact_result` — not by a client-parsed line-
  marker convention. The model calls `record_fact_result` every turn with
  its judgment on the last answer plus its own freely-chosen next
  itemId/factType; `learn-tool-execute.cjs` validates that proposed pick
  against real coverage server-side (falling back to the first open item
  if it's missing/stale/invalid) and decides whether there's a next
  question at all — a pass boundary or full coverage always wins over
  whatever the model proposed. Visible text is still line-delimited, but
  with a smaller, different marker set than originally planned: `TICO:` /
  `GUEST:` / `STATUS:` / `IMAGE:` (see `learn-markers.js`,
  `SEGMENT_MARKER_RE`/`SEGMENT_MARKER_HOLDBACK` = 7, the length of
  `"STATUS:"`) — there's no `ITEM:`/`FACT_TYPE:`/`RESULT:` marker set;
  that data travels through the tool call's structured input instead.
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
- `netlify/edge-functions/chat-stream.ts` — CORRECTED: `learn`'s
  `toolExecuteEndpoint` is still `/api/learn-tool-execute` — it was never
  set to `null`, since the tool call itself was kept (see the key
  decisions section above).

**Backend**
- `netlify/functions/_services/db-restaurants.cjs` — exposes `item.id`.
- `netlify/functions/_services/db-learn-progress.cjs` — rewritten around
  the `lp-` per-(user, restaurant) schema above.
- `netlify/functions/_services/learn-coverage-logic.cjs` (NEW, missing
  from the original plan) — the server-side half of the pass/coverage
  arithmetic (`findSection`, `derivePass`, `openTargets`,
  `mergeFactResult`), used by both `learn-chat-init.cjs` and
  `learn-tool-execute.cjs`.
- `netlify/functions/_utils/data-utils.cjs` (NEW) — `generateChatId()`/
  `generateProgressId()`, the one place server-side id prefixes live.
- `netlify/functions/learn-progress-write.cjs` (NEW) — one write endpoint
  for the resource (`itemId`+`factType` and/or `lastTrained`), not one
  endpoint per field — matches `learn-chats`' get/save shape.
- `netlify/functions/learn-progress-get.cjs` (NEW) — reads
  `{sections, lastTrained}` for one restaurant.
- `netlify/functions/learn-tool-execute.cjs` — CORRECTED: NOT deleted —
  rewritten to handle the new `record_fact_result` tool (see key
  decisions above), not removed.
- `netlify/functions/learn-chat-init.cjs` — rewritten: pass-aware
  `buildSectionPrompt`, uncached `buildCoveragePrompt`. CORRECTED: the
  visible-text format is `TICO:`/`GUEST:` (not the `ITEM:`/`FACT_TYPE:`/
  `RESULT:` set this plan originally intended), and it still builds and
  passes real tools (`buildTools(pass, openList)`) — `tools: []` never
  happened.

**Client**
- `src/assets/js/menu-restaurant-filter.js` — rendering/filter/browse only
  (see file boundaries above); computes/refreshes browse-list pills, the
  Train-link target, and the Review panel's initial `data-pass`.
- `src/assets/js/learn-practice.js` (NEW) — the Practice chat: the
  `record_fact_result` tool-call flow, fact-coverage tracking, the
  pass-transition/tier banners, per-section chat persistence, the
  flag-and-confirm correction flow. CORRECTED: marker parsing itself
  (`SEGMENT_MARKER_RE`/`SEGMENT_MARKER_HOLDBACK`) actually lives in a
  separate new file, `learn-markers.js` (see below) — 4 markers (`TICO`/
  `GUEST`/`STATUS`/`IMAGE`), holdback 7 (length of `"STATUS:"`), not the
  "5 markers, holdback 10" this plan originally guessed at.
- `src/assets/js/learn-markers.js` (NEW, missing from the original plan)
  — marker/segment parsing off the raw stream (`createStreamRenderer`,
  `renderAssistantTurn`) plus the getting-started/review-started/show-card
  transcript elements. Split out from `learn-practice.js` rather than
  inline there.
- `src/assets/js/learn-coverage.js` (NEW, not under `utils/`) — cache/
  reconcile logic (`hydrateSectionCoverage`, `hydrateRestaurantProgress`)
  and the tier/pass arithmetic (`passForSection`, `tierForSection`,
  `computeTierBySection`, `tierForSectionInProgress`) — CORRECTED: three
  tiers (training/covered/mastered), not `isSectionMastered` as a
  boolean.
- `src/assets/js/collections/learn-progress.js` (NEW) — thin CRUD
  (`getLearnProgress`/`writeLearnProgress`), no caching or derived logic,
  matching `collections/learn-chats.js`'s shape.
- `src/assets/js/utils/data-utils.js` (renamed from `utils/id.js`) —
  `generateChatId()` added; `menu-restaurant-filter.js`'s old inline
  duplicate removed.
- `src/assets/js/learned-sections.js` — deleted (superseded by
  `learn-coverage.js`'s per-item-per-fact-type tracking).

**Templates & styles**
- `src/menu.njk` — CORRECTED: no progress bar was ever added here. A
  progress bar was tried and then deliberately dropped in favor of the
  Training/Covered/Mastered tier states above doing that job instead —
  `#menu-practice`'s status line (`appendStatusMarker` in
  `learn-practice.js`) covers this in-transcript instead of template
  markup.
- `src/styles/_learn.scss` — pass-transition banner and the
  `.menu-detail__review[data-pass]` highlight selectors (no progress bar
  styles — see above).
- `src/styles/_menu-review.scss` — `.menu-category__header` (wraps the
  category name + pill on one row) and `.menu-category__pill` variants.

**Not touched, deliberately**: `menu-categories.njk` and `/menu-review/`
are orphaned (unlinked, untouched since before the `/menu/` rewrite) but
`/menu-review/`'s own concept (review extracted menu JSON before it
becomes THE menu) is still valid, just not built yet — out of scope here.

## Verification

1. `node --check` on every new/modified `.cjs` file — done, all pass.
2. Full `pnpm`/`npm run build` (SCSS + Vite bundle) — done, passes clean.
3. CORRECTED — superseded by real usage rather than formally worked
   through as a checklist: the feature has been live and in everyday use
   since (Erik actively drilling real menu/drink sections), which is a
   stronger signal than a one-time manual pass would have been. The
   items below were the original test plan; not re-verified line-by-line
   against today's `ITEM:`/`FACT_TYPE:`/`RESULT:`-less, tool-call-based
   reality, but nothing in ongoing use suggests any of the underlying
   behavior is broken.
   - Fresh section's Practice: price/tags muted, description bold
     (`data-pass="basics"`); drill only asks ingredient questions even if
     volunteered otherwise.
   - Finish every item's ingredients: input disables, transition banner
     fires exactly once, Continue flips to Review with price/tags now
     bold, Practice resumes the same conversation asking only
     dietary/pricing.
   - Finish dietary + pricing: tier banner fires, the matching
     `learn-progress/{lp-...}` doc in Firestore (found by
     `_userId`/`_restaurantId`) shows `sections` → section → item → all
     three fact types `true`, and the browse pill flips to Covered (see
     the corrected tier vocabulary above — not Mastered, which isn't
     computed yet).
   - Enter Practice for a different section without finishing the first:
     confirm the Training pill moves, doesn't linger on the old section.
   - Reload mid-Basics and mid-Complete: pass resumes correctly (no
     progress bar to check — see above).
   - Restaurant isolation: progress at one restaurant doesn't leak into a
     same-named section at another.
   - Clear localStorage mid-drill, reload: coverage recovers from
     Firestore, doesn't reset to zero.
   - Cache check (with a real API key): `cache_read_input_tokens` shows
     reads turn 2+ within one pass; a pass boundary is an expected,
     acceptable miss on the section block.
