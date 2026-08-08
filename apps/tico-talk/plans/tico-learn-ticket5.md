# Ticket 5: /learn/ drill — two-pass coverage (Basics → Complete), tiered picker, per-turn context caching split

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket touches the same layers as Tickets 1-4: the shared streaming core
(`packages/edge-functions/chat-stream-core.ts`), the per-turn prompt
builder (`netlify/functions/learn-chat-init.cjs`), Firestore persistence
(`_services/`), and the drill's client-side rendering
(`src/assets/js/learn.js`), plus (new to this ticket) the shared teach
screen macro (`src/_includes/menu-categories.njk`).

**Depends on Tickets 1-4** — specifically Ticket 4's two-block cached
system prompt, its `restaurant-notes` collection, and (per Ticket 4's
rewrite) its multi-restaurant data model: `restaurantId` already flows
through `chat-stream-core.ts`'s `initBody`, `learn-chat-init.cjs`, and
every Firestore lookup by the time this ticket starts. This ticket adds
a third prompt block, removes Ticket 2/3's `mark_section_learned` tool
entirely, and **replaces** Ticket 3's boolean `learn-progress` schema and
checkmark-badge UI with per-item, per-fact-type coverage split across
two gated passes — all of it nested under the restaurant dimension Ticket
4 already established, not a parallel single-restaurant version to
reconcile later. Build Ticket 4 first.

**Why this ticket exists, and why it changed shape mid-design**: started
from live-testing exposing that `mark_section_learned` was a single,
vague, model-self-graded judgment call. First redesign: deterministic
coverage, one tool-free tally per item. Then, live-testing *that* design
(mentally, before building it) surfaced a second problem: glancing at
4-5 items' full descriptions, prices, add-ons, and dietary tags all at
once, then immediately fielding contextual questions pulling from any of
it, felt overwhelming even to someone with a strong academic memorization
background, a real signal that the actual target audience (restaurant
staff, high turnover, studying between shifts) would find it worse. That
reframed the design again: not just *whether* an item is covered, but
*which kind of fact* it's covered on, taught and drilled in two
deliberately separated, gated passes.

**Existing data note**: any `learn-progress` docs from testing Ticket 3
use the old `{sectionName: true}` boolean shape with no restaurant
dimension at all (Ticket 3 predates multi-restaurant); this ticket's
shape is `{restaurantId: {sectionName: {itemId: {factType: true, ...}}}}`,
structurally incompatible on two counts, not just the fact-type nesting.
Still pre-launch (only Erik's testing data exists), so the plan is to
let old test data go stale rather than migrate it, confirm that's still
true before implementing.

## Overview

**The core idea, restated end to end**: each section has two passes.

1. **Basics** — ingredients only. Teach screen shows the section with
   descriptions (ingredients) visually emphasized, price and dietary tags
   muted. Drilling only asks ingredient-type questions ("what's in the
   queso," never "is it gluten-free" or "how much is it") until every
   item's ingredients have been correctly answered once.
2. **Complete** — dietary + pricing, together (not further split, that's
   the "not too many passes" tradeoff). Once Basics finishes, a short
   transition moment fires, then the teach screen shows again with price
   and dietary tags emphasized, description muted. Drilling only asks
   dietary/pricing-type questions from here on, until every item has both
   confirmed.
3. Once Complete finishes for every item, the section is **Capable**
   (the ceiling this app alone can grant, per the existing skill-tree
   scale — Natural/Mastered stay earned through real Practice reps, a
   separate, not-yet-built system).

Which pass a section is in is **derived, not separately stored**: it's
just "have all items got `ingredients: true` yet?" — no separate pass
flag to desync from the underlying coverage data.

**Design note — why this replaced the earlier deterministic-but-flat
version**: that version (one tool-free tally per item, any one correct
answer covers it) solved the "model self-grades its own confidence"
problem but not the "wall of undifferentiated facts, then quizzed on
anything" problem. Splitting facts into ingredients vs. dietary+pricing,
and gating the *drill's own question scope* to match whichever pass is
active (not just prioritizing, actually restricting), addresses the
cognitive-load complaint directly, at both ends: what's shown to read
and what's asked afterward.

**Design note — why two passes, not three**: dietary and pricing are
grouped together deliberately, not each given their own pass. Both are
already lower cognitive load than ingredients (a tag or a number, not a
sentence to parse), and further splitting risks trading "overwhelming"
for "tedious, too many hoops." Two passes was the balance landed on
during design.

**Design note — why this replaces the tool, and why a third uncached
prompt block**: unchanged from the earlier version of this ticket. The
model reports two (now three, with `FACT_TYPE:`) small checkable facts
per round instead of self-grading its own confidence, and "is this pass
done" is arithmetic in our own code, not a model judgment call. Anthropic
only reuses a cached prefix when it's byte-identical to a recent
previous call; live coverage state changes every turn, so it lives in
its own small, deliberately uncached block, keeping the (now
pass-specific, but still static per pass) section block cache-eligible.

**Design note — Firestore is authoritative, localStorage is a cache, not
the other way around**: raised directly during design, correcting a real
mistake in the first draft of this ticket. Writes to `learn-progress`
were already fire-and-forget to Firestore the moment an item got
covered, but nothing ever *read* from Firestore, `startDrill()` and the
picker's tier badges both trusted localStorage alone. That meant
Firestore was functionally a write-only log the app never checked —
clear your browser data, or open the app on a different device, and all
progress looks gone even though Firestore has the complete record. The
fix: `learn-progress-get.cjs` (File 5) is a real read path, called on
load. localStorage still gets read first for an instant paint (no
blank-state flash while a network request is in flight), but the
fetched Firestore result is what the app actually trusts, merged into
and overwriting the cache, not deferred to it. Coverage is monotonic (a
fact once covered is never uncovered), so reconciling cache against
server is a simple union merge, not real conflict resolution. This also
means Ticket 7's management view can read genuine progress by user id
from any device, not just "whichever browser happened to do the
training," which the original (uncorrected) design would have silently
limited it to.

**Design note — `learn-chat-init.cjs` runs every turn, not once**:
`chat-stream-core.ts` calls the `initEndpoint` fresh on every POST to
`/api/chat-stream`, not just at conversation start (the edge function is
stateless, the whole conversation lives in client-sent `chatHistory`).
Refer to this file's role in comments/docs as building fresh turn
context (`buildTurnContext`, conceptually), not one-time initialization
— the file/endpoint name itself stays `learn-chat-init.cjs` for
consistency with the other four apps using this shared core.

## Phase 0: Explore First

- Everything Ticket 5's original Phase 0 already named (unchanged):
  `learn-chat-init.cjs` as Ticket 4 leaves it, `chat-stream-core.ts`'s
  `initBody` construction, `learn.js`'s `SEGMENT_MARKER_RE`/
  `createStreamRenderer()`/`renderAssistantTurn()`, `db-learn-progress.cjs`,
  the existing 4-dot skill-tree tier system
  (`_components.scss:237-262`, `practice.njk:77-129`).
- `src/_includes/menu-categories.njk` — the shared teach-screen macro
  (`render(categories, highlightNotes)`), also used by `/menu/` and
  `/menu-review/`. Note the existing per-field classes:
  `.menu-item__desc` (ingredients), `.menu-item__tags`/`.menu-item__tag`
  (dietary), `.menu-item__price` (pricing) — these map directly onto the
  three fact types with zero macro changes needed. Highlighting is
  driven by a `data-pass` attribute on an ancestor element and pure CSS
  attribute selectors (see File 9), not a new macro parameter — keeps
  `/menu/`'s public rendering (which never sets `data-pass`) completely
  unaffected.
- `src/learn.njk`'s `.learn-teach__section`/`.learn-start-drill` — the
  existing teach-then-drill transition. This ticket reuses the exact
  same button/flow for *both* the Basics→drill and Complete→drill
  transitions, the teach screen just gets shown a second time with
  different `data-pass` state and isn't a new code path.

## File 1: `packages/edge-functions/chat-stream-core.ts` (MODIFY, shared)

`restaurantId` is already threaded through this file by Ticket 4 — don't
re-add it. This ticket adds one more field, `factCoverage` (replaces the
earlier `coveredItemIds` idea — richer, per item per fact type), to
`RequestBody` and passes it through to `initBody`, same pattern:

```typescript
// RequestBody interface, alongside `section`:
factCoverage?: Record<string, Record<string, boolean>>; // ADDED: {itemId: {factType: true}} for tico-talk "learn"
```

```typescript
// initBody-building else branch:
} else {
  initBody = { userId, timezone, userName };
  if (replyToMomentId) initBody.replyToMomentId = replyToMomentId;
  if (section) initBody.section = section;
  if (factCoverage) initBody.factCoverage = factCoverage;
}
```

Shared file, not a per-app fork (confirmed in Ticket 2). Edit
`packages/edge-functions/chat-stream-core.ts` directly, then re-sync.

## File 2: sync step

```bash
cp packages/edge-functions/chat-stream-core.ts apps/tico-talk/netlify/edge-functions/_lib/chat-stream-core.ts
```

## File 3: `netlify/functions/_services/db-learn-progress.cjs` (MODIFY)

```javascript
// Schema comment, updated — restaurant is the outermost key, matching
// every other Ticket 4+ collection:
//   learn-progress/{userId}
//   {
//     "margaritaville": {
//       "Starters": {
//         "chips-and-salsa": { "ingredients": true, "dietary": true, "pricing": true },
//         "guacamole": { "ingredients": true }
//       }
//     },
//     "petes": { ... }
//   }

/**
 * Mark one fact type, for one item, within a section, within a
 * restaurant, as covered. Relies on dbCore.create()'s {merge: true}
 * performing a recursive merge on nested map fields (confirmed
 * Firestore behavior) — sibling restaurants/items/fact-types/sections
 * are untouched.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 * @param {string} itemId
 * @param {'ingredients'|'dietary'|'pricing'} factType
 */
exports.markFactLearned = async (userId, restaurantId, sectionName, itemId, factType) => {
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [restaurantId]: { [sectionName]: { [itemId]: { [factType]: true } } } }
  });
};

/**
 * Read back a user's full progress for one restaurant — the genuine
 * source of truth this ticket adds a real read path for (see the
 * "Firestore is authoritative, localStorage is a cache" design note
 * above). Returns {} if the user has no progress at this restaurant yet,
 * never throws for that case.
 * @param {string} userId
 * @param {string} restaurantId
 * @returns {Promise<Object>} {sectionName: {itemId: {factType: true}}}
 */
exports.getLearnProgress = async (userId, restaurantId) => {
  const doc = await dbCore.get({ collection: COLLECTION, id: userId });
  return doc?.[restaurantId] || {};
};
```

`markSectionLearned` and `getLearnProgress`'s old boolean-schema version
(Ticket 3) and `markItemLearned` (this ticket's earlier draft) all get
removed, superseded by `markFactLearned`/this new `getLearnProgress`.

## File 4: `netlify/functions/learn-fact-learned.cjs` (NEW)

Replaces the earlier draft's `learn-item-learned.cjs` — same shape, one
more field.

```javascript
const { markFactLearned } = require('./_services/db-learn-progress.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, restaurantId, section, itemId, factType } = JSON.parse(event.body || '{}');
    if (!userId || !restaurantId || !section || !itemId || !factType) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, restaurantId, section, itemId, and factType are required' }) };
    }

    await markFactLearned(userId, restaurantId, section, itemId, factType);
    log('debug', '[learn-fact-learned] covered', factType, 'for', itemId, 'in', section, 'at', restaurantId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    log('error', '[learn-fact-learned] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

Fire-and-forget from the client — but unlike the earlier draft, this
isn't "localStorage is the source of truth regardless." Firestore *is*
the source of truth (see the design note above); this write just doesn't
need to block the UI on succeeding, since File 5's read path is what the
client actually trusts on load, not whatever's cached locally at the
moment of the write.

## File 5: `netlify/functions/learn-progress-get.cjs` (NEW)

The read path this ticket was missing. Returns a user's full progress
for one restaurant — called on load to hydrate real state, not just to
back up a localStorage cache that was already treated as authoritative.

```javascript
const { getLearnProgress } = require('./_services/db-learn-progress.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { userId, restaurantId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
  if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };

  try {
    const progress = await getLearnProgress(userId, restaurantId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress }) };
  } catch (error) {
    log('error', '[learn-progress-get] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

This is also what Ticket 7's management view calls directly — same
endpoint, no separate management-only read path needed, it was always
going to need a real progress-by-user-id read, this ticket is just what
actually builds it.

## File 6: `netlify/functions/learn-chat-init.cjs` (MODIFY)

The big one. `buildSectionPrompt` now takes the current pass and only
describes/permits that pass's fact type(s). The coverage block filters
"what's remaining" to the current pass too — no point telling the model
about dietary/pricing gaps while it's still restricted to ingredients.

```javascript
const { getRestaurant } = require('./_services/db-restaurants.cjs'); // Ticket 4's multi-restaurant service, not db-menu.cjs
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

const PASS_FACT_TYPES = {
  basics: ['ingredients'],
  complete: ['dietary', 'pricing']
};

function findSection(restaurant, sectionName) {
  return restaurant.categories.find((c) => c.name === sectionName) || null;
}

function derivePass(section, factCoverage) {
  const allIngredientsDone = section.items.every((i) => factCoverage?.[i.id]?.ingredients);
  return allIngredientsDone ? 'complete' : 'basics';
}

// unchanged from Ticket 4, filters to scope === 'restaurant', takes the
// restaurant object for its name in the framing text
function buildSharedPrompt(restaurant, notes) { /* ...as Ticket 4 wrote it... */ }

// Now pass-aware (on top of Ticket 4's restaurant-aware version). Two
// distinct, still-static-within-a-pass variants per restaurant — each
// independently cacheable across turns/trainees within that pass at
// that restaurant; a pass boundary is a natural, rare, acceptable cache
// miss, same as a restaurant boundary already was in Ticket 4.
function buildSectionPrompt(restaurant, section, notes, pass) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { id: item.id, name: item.name };
    // Only expose the fields relevant to the CURRENT pass — not just an
    // instruction to ignore the rest, actually omit them, so there's no
    // ambiguity about what's in scope right now.
    if (pass === 'basics') {
      trimmed.description = item.description;
    } else {
      trimmed.price = item.price;
      if (item.tags && item.tags.length) trimmed.tags = item.tags;
    }
    if (item.notes) trimmed.notes = item.notes; // notes can matter either pass, kept in both
    return trimmed;
  });

  const sectionNotes = notes.filter((n) => n.scope === 'section' && n.section === section.name);
  const sectionNotesBlock = sectionNotes.length
    ? `\nADDITIONAL NOTES FOR THIS SECTION (equally authoritative to SECTION DATA):\n${sectionNotes.map((n) => `- ${n.text}`).join('\n')}\n`
    : '';

  const passScope = pass === 'basics'
    ? `You are drilling BASICS only right now: ingredients. Every question must be about what's in a dish (ingredients, preparation, what it's made of). Never ask about price, dietary restrictions, or add-ons in this pass, even if the trainee brings one up, gently redirect back to ingredients or note you'll circle back to that later.`
    : `You are drilling COMPLETE right now: dietary restrictions and pricing. Ingredients are already covered for this section, don't re-drill them. Every question must be about whether a dish is vegetarian/gluten-free/dairy-free/etc, or its price/add-on cost. Never ask a pure ingredients question in this pass.`;

  return `Drilling section: "${section.name}", ${pass} pass.

${passScope}

Each round works like this: you ask ONE question, in scope for this pass, as if you were an ordinary seated customer looking at this section. Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with one of "TICO:", "GUEST:", "ITEM:", "FACT_TYPE:", or "RESULT:" (all caps, immediately followed by a colon and a space), marking what that line is.
- GUEST: the customer's own question or line of dialogue.
- TICO: everything that's you: narrating the scene, evaluating the trainee's answer, or any other aside.
- ITEM: only right before you evaluate an answer, one line, the id of the specific dish (use the "id" field from SECTION DATA below, e.g. "baja-fish-tacos").
- FACT_TYPE: only right after an ITEM: line, one line, one word: ${pass === 'basics' ? '"ingredients" (the only valid value this pass)' : '"dietary" or "pricing"'}.
- RESULT: only right after a FACT_TYPE: line, one line, one word: "correct", "partial", or "incorrect".

ITEM:/FACT_TYPE:/RESULT: lines are never shown to the trainee, they're just for tracking. Always emit all three together, right before your TICO: evaluation (never on the very first question of the drill, there's nothing to evaluate yet). Never put content from two different markers on the same line, never skip a marker on a new line.

STOP after your GUEST: question, every turn. Never invent, assume, or simulate what the trainee would say, only evaluate an answer they actually gave earlier in this conversation.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

SECTION DATA (${section.name} only, ${pass} pass, only the fields relevant to this pass are included):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
}

// Uncached, per-turn. Filtered to the current pass's fact type(s) only.
function buildCoveragePrompt(section, notes, factCoverage, pass) {
  const types = PASS_FACT_TYPES[pass];
  const remaining = [];
  const done = [];
  section.items.forEach((item) => {
    types.forEach((type) => {
      const label = `${item.id} (${type})`;
      if (factCoverage?.[item.id]?.[type]) done.push(label); else remaining.push(label);
    });
  });

  if (remaining.length === 0) {
    return `CURRENT COVERAGE: every ${pass}-pass fact for this section is already covered. Wrap up warmly, let the trainee know they've got this pass down, and don't manufacture new questions just to keep going.`;
  }

  return `CURRENT COVERAGE (${pass} pass): still need: ${remaining.join(', ')}.${done.length ? ` Already covered, don't re-drill unless genuinely useful: ${done.join(', ')}.` : ''} Prioritize what's not covered yet.`;
}

const tools = []; // no tools for Learn — coverage is fully client-computed

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, section: sectionName, factCoverage } = JSON.parse(event.body || '{}');
    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    }
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const restaurant = await getRestaurant(restaurantId);
    const notes = await getRestaurantNotes(restaurantId);

    const section = findSection(restaurant, sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    const pass = derivePass(section, factCoverage);

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes, pass), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildCoveragePrompt(section, notes, factCoverage, pass) } // no cache_control
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemMessages, tools })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

Confirm `chat-stream-core.ts` still handles the empty `tools` array
gracefully (it should, per its existing `tools.length > 0 ? tools :
undefined` guard) — don't assume, verify while implementing.

## File 7: `src/assets/js/learn.js` (MODIFY)

**Extend `SEGMENT_MARKER_RE`** for the fifth marker:

```javascript
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST|ITEM|FACT_TYPE|RESULT):[ \t]?/;
```

**`createStreamRenderer()`** needs a third hidden-marker slot. Same
"accumulate silently, process on segment close" shape as the two-marker
version, just one more pending value to carry between `ITEM:` and
`RESULT:`:

```javascript
function createStreamRenderer(onFactResult) {
  let consumedLen = 0;
  let currentMarker = null;
  let currentBubble = null;
  let currentBuffer = '';
  let pendingItemId = null;
  let pendingFactType = null;

  function closeCurrentSegment() {
    if (currentMarker === 'ITEM') {
      pendingItemId = currentBuffer.trim();
    } else if (currentMarker === 'FACT_TYPE') {
      pendingFactType = currentBuffer.trim();
    } else if (currentMarker === 'RESULT') {
      const result = currentBuffer.trim();
      if (pendingItemId && pendingFactType && result) onFactResult(pendingItemId, pendingFactType, result);
      pendingItemId = null;
      pendingFactType = null;
    }
    currentBuffer = '';
  }

  function openSegment(marker) {
    currentMarker = marker;
    currentBubble = (marker === 'TICO' || marker === 'GUEST')
      ? createSegmentElement(marker === 'TICO' ? 'tico' : 'guest')
      : null;
  }

  function absorb(chunk) {
    if (!chunk) return;
    if (currentBubble) {
      currentBubble.appendChild(document.createTextNode(chunk));
      currentBubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      currentBuffer += chunk;
    }
  }

  return {
    update(fullTextSoFar) {
      for (;;) {
        const unconsumed = fullTextSoFar.slice(consumedLen);
        const m = SEGMENT_MARKER_RE.exec(unconsumed);
        if (m && m.index === 0) {
          closeCurrentSegment();
          openSegment(m[1]);
          consumedLen += m[0].length;
          continue;
        }
        if (m && m.index > 0) {
          absorb(unconsumed.slice(0, m.index));
          consumedLen += m.index;
          continue;
        }
        if (unconsumed.length > SEGMENT_MARKER_HOLDBACK) {
          const safeLen = unconsumed.length - SEGMENT_MARKER_HOLDBACK;
          absorb(unconsumed.slice(0, safeLen));
          consumedLen += safeLen;
        }
        break;
      }
    },
    finalize(fullText) {
      absorb(fullText.slice(consumedLen));
      consumedLen = fullText.length;
      closeCurrentSegment();
    }
  };
}
```

`SEGMENT_MARKER_HOLDBACK` becomes `10` (`"FACT_TYPE:"` is now the
longest marker, not `"GUEST:"`).

`renderAssistantTurn()` (rehydration): same "skip creating a segment for
non-TICO/GUEST markers" behavior, now three marker types to skip instead
of two.

**Coverage tracking, two-dimensional, plus pass derivation**:

```javascript
// ─── Fact coverage (two-dimensional: item × fact type) ──────────────────
const PASS_FACT_TYPES = { basics: ['ingredients'], complete: ['dietary', 'pricing'] };

let sectionItemIds = []; // set in startDrill()
let factCoverage = {}; // {itemId: {factType: true}}
let passTransitionShown = false; // guards the mid-drill transition banner from firing twice

function lsCoverageKey(section) {
  // currentRestaurantId comes from Ticket 4's restaurant.js utility —
  // coverage for the same section name must never bleed across
  // restaurants (Margaritaville's "Starters" and Pete's "Starters" are
  // different items entirely).
  return `tico-learn-coverage-${currentRestaurantId}-${section}`;
}

// localStorage here is a CACHE of Firestore, not an independent store —
// Firestore is the actual source of truth (see the design note above,
// added specifically because the first draft of this ticket got this
// backwards: it wrote to Firestore but only ever read from localStorage,
// meaning a cleared browser or a different device silently lost all
// progress even though Firestore had the full record).

function loadFactCoverageCache(section) {
  try {
    const raw = localStorage.getItem(lsCoverageKey(section));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveFactCoverageCache(section, coverage) {
  try { localStorage.setItem(lsCoverageKey(section), JSON.stringify(coverage)); } catch {}
}

// Union merge — safe because coverage is monotonic (a fact, once
// covered, is never uncovered), so merging two coverage maps can only
// ever add true flags, never lose or contradict one. No conflict
// resolution needed, just combine.
function mergeFactCoverage(a, b) {
  const merged = {};
  for (const itemId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    merged[itemId] = { ...a[itemId], ...b[itemId] };
  }
  return merged;
}

/**
 * The actual load path: paint instantly from whatever's cached locally,
 * then fetch the real record from Firestore and reconcile. If Firestore
 * has more than the local cache (new device, cache was cleared, a
 * fire-and-forget write from a previous session landed after the cache
 * was last written), the merged result reflects that — the UI upgrades
 * from "possibly stale" to "confirmed" rather than trusting the cache
 * forever.
 */
async function hydrateFactCoverage(section) {
  const cached = loadFactCoverageCache(section);
  factCoverage = cached; // instant paint, matches previous behavior
  updateProgressBar();

  try {
    const response = await fetch(`/api/learn-progress-get?userId=${encodeURIComponent(getOrCreateUserId())}&restaurantId=${encodeURIComponent(currentRestaurantId)}`);
    const { progress } = await response.json();
    const remoteCoverage = progress?.[section] || {};
    const reconciled = mergeFactCoverage(cached, remoteCoverage);
    factCoverage = reconciled;
    saveFactCoverageCache(section, reconciled); // cache now reflects the confirmed state
    updateProgressBar(); // re-render if the fetch added anything the cache didn't have
  } catch {
    // Firestore unreachable — fall back to the local cache silently,
    // already painted above. Not ideal, but not worse than the old
    // localStorage-only behavior, and doesn't block the drill.
  }
}

function currentPass() {
  const allIngredientsDone = sectionItemIds.every((id) => factCoverage[id]?.ingredients);
  return allIngredientsDone ? 'complete' : 'basics';
}

function passProgress(pass) {
  const types = PASS_FACT_TYPES[pass];
  let done = 0;
  const total = sectionItemIds.length * types.length;
  sectionItemIds.forEach((id) => types.forEach((t) => { if (factCoverage[id]?.[t]) done++; }));
  return { done, total };
}

function updateProgressBar() {
  const pass = currentPass();
  const { done, total } = passProgress(pass);
  progressBar.style.setProperty('--progress', total ? `${(done / total) * 100}%` : '0%');
  progressBarLabel.textContent = pass === 'basics'
    ? `Basics: ${done} of ${total}`
    : `Complete: ${done} of ${total}`;
  progressBar.dataset.pass = pass; // for styling — see File 9
}

function handleFactResult(itemId, factType, result) {
  if (!sectionItemIds.includes(itemId)) return;
  if (!['ingredients', 'dietary', 'pricing'].includes(factType)) return;
  if (factCoverage[itemId]?.[factType]) return; // already covered, monotonic
  if (result !== 'correct') return;

  const passBefore = currentPass();
  factCoverage[itemId] = factCoverage[itemId] || {};
  factCoverage[itemId][factType] = true;
  saveFactCoverageCache(currentSection, factCoverage);
  updateProgressBar();

  fetch('/api/learn-fact-learned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: getOrCreateUserId(), restaurantId: currentRestaurantId, section: currentSection, itemId, factType })
  }).catch(() => {});

  const passAfter = currentPass();
  if (passBefore === 'basics' && passAfter === 'complete' && !passTransitionShown) {
    passTransitionShown = true;
    showPassTransition();
    return;
  }
  if (passAfter === 'complete' && passProgress('complete').done === passProgress('complete').total) {
    showLearnedBanner(); // copy updates to "Capable" — see below
    markSectionLearnedLocally(currentSection);
    applyLearnedBadges();
  }
}
```

**Pass transition** — disables the input, shows a distinct inline
banner, and routes back through the teach screen (reusing the existing
`.learn-start-drill` button, not a new flow):

```javascript
function showPassTransition() {
  answerInput.disabled = true;
  sendButton.disabled = true;
  const banner = document.createElement('div');
  banner.className = 'learn-pass-transition';
  banner.innerHTML = `
    <p class="learn-pass-transition__label">You've got the basics down for ${currentSection}. Let's go deeper on dietary and pricing.</p>
    <button type="button" class="btn" data-action="continue">Continue</button>
  `;
  transcript.appendChild(banner);
  banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
  banner.querySelector('[data-action="continue"]').addEventListener('click', () => {
    document.querySelectorAll('.learn-teach__section').forEach((el) => {
      el.hidden = el.dataset.section !== currentSection;
      el.dataset.pass = currentPass(); // 'complete' by this point — drives highlighting, see File 9
    });
    showPhase('teach');
  });
}
```

`showLearnedBanner()`'s copy changes from "You've learned X!" to match
the tier vocabulary: `` `You're Capable at ${currentSection}!` ``.

**`startDrill()`**: needs `sectionItemIds` (all item ids in the current
section) client-side now, same open question as the earlier draft of
this ticket — the menu data lives in Firestore as of Ticket 4, not
statically `require()`-able into a browser module, so this needs either
item ids embedded in the picker/teach markup via `data-*` attributes, or
a small endpoint. Resolve while implementing. Also loads persisted
coverage and sets the teach screen's initial `data-pass`:

```javascript
function startDrill() {
  passTransitionShown = false;
  hydrateFactCoverage(currentSection); // paints from cache instantly, reconciles with Firestore async
  // ...existing loadSectionState()/rehydration logic, unchanged...
}
```

And wherever the picker pill click handler currently reveals the right
`.learn-teach__section` (Ticket 1), also set its initial `data-pass`
before first showing it:

```javascript
// Picker → Teach (existing handler, one line added):
document.querySelectorAll('.learn-teach__section').forEach((section) => {
  section.hidden = section.dataset.section !== currentSection;
  if (!section.hidden) section.dataset.pass = 'basics'; // always starts here on a fresh entry from the picker
});
```

(A returning trainee re-entering a section already in the Complete pass
via URL-restore or rehydration needs this set to `currentPass()`'s
actual value instead of a hardcoded `'basics'` — check both entry paths,
picker-click and URL-restore, set it consistently.)

**Wire `handleFactResult` and `factCoverage` into `sendTurn()`**, same
shape as the earlier draft, one more field in the request body
(`restaurantId` itself is already there from Ticket 4, not new here):

```javascript
const renderer = createStreamRenderer(handleFactResult);
...
body: JSON.stringify({
  chatType: 'learn',
  userId: getOrCreateUserId(),
  message,
  chatHistory,
  restaurantId: currentRestaurantId,
  section: currentSection,
  factCoverage
})
```

## File 8: `src/learn.njk` (MODIFY)

Progress bar in the drill (unchanged position from the earlier draft,
now pass-aware via `data-pass` set from JS, not the markup):

```html
<div class="learn-drill" id="learn-drill" hidden>
  <p class="breadcrumb__back learn-back" data-target="picker">‹ Choose a different section</p>
  <div class="learn-progress-bar" id="learn-progress-bar">
    <div class="learn-progress-bar__fill"></div>
  </div>
  <p class="learn-progress-bar__label" id="learn-progress-bar-label"></p>
  <div class="learn-transcript-scroll" id="learn-transcript-scroll">
    ...
```

Teach screen sections need a `data-pass` attribute (JS sets/updates it,
per File 7 — the markup just needs the attribute present so CSS has
something to select on from the start):

```html
<div class="learn-teach__section" data-section="{{ category.name }}" data-pass="basics" hidden>
  ...
  {{ renderCategories([category], false) }}
  <button class="btn learn-start-drill" data-section="{{ category.name }}">Start practicing</button>
</div>
```

Picker pills gain the tier-dot readout, same as the earlier draft
(reuse `.tier-dots`/`.tier-dot`/`.tier-indicator__label` as-is, judgment
call on exact markup once it's in front of you, don't duplicate the
visual system).

## File 9: `src/styles/_learn.scss` and `_competency-select.scss` (MODIFY)

```scss
.learn-progress-bar {
  height: 4px;
  background: $color-border;
  border-radius: 999px;
  overflow: hidden;
  margin: 0 $space-lg;
  flex-shrink: 0;
}

.learn-progress-bar__fill {
  height: 100%;
  width: var(--progress, 0%);
  background: $color-green;
  transition: width 0.4s ease;
}

.learn-progress-bar__label {
  font-size: $font-size-sm;
  color: $color-text-muted;
  text-align: center;
  margin: $space-xs $space-lg $space-sm;
  flex-shrink: 0;
}

.learn-pass-transition {
  text-align: center;
  padding: $space-lg;
  margin: $space-md $space-lg 0;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: 0.75rem;
}

.learn-pass-transition__label {
  margin: 0 0 $space-md;
  font-weight: 600;
}

// ─── Teach screen pass highlighting ──────────────────────────────────────
// Driven entirely by data-pass on .learn-teach__section, set/updated by
// JS (File 7). Public /menu/ and /menu-review/ never set this attribute,
// so renderCategories() itself needs zero changes — this is pure additive
// CSS on top of its existing .menu-item__desc/__tags/__price classes.
.learn-teach__section[data-pass="basics"] {
  .menu-item__price,
  .menu-item__tags { opacity: 0.35; }
  .menu-item__desc { font-weight: 600; }
}

.learn-teach__section[data-pass="complete"] {
  .menu-item__desc { opacity: 0.5; }
  .menu-item__price,
  .menu-item__tags { font-weight: 600; }
}
```

Remove `.competency-pill--learned` from `_competency-select.scss`
(superseded by the tier-dot readout). `.tier-dots`/`.tier-dot`/
`.tier-indicator__label` already exist in `_components.scss`, no changes
needed there, just reuse. Tier computed from `factCoverage`: 0 done =
Not started, partial = Training, Complete pass fully done = Capable —
same arithmetic `passProgress()` already does. The picker's badges need
the same cache-then-reconcile treatment as the drill itself: paint from
whatever's in each section's localStorage cache immediately (avoids a
blank picker while waiting on a network round trip), then fetch real
progress per section from `/api/learn-progress-get` (File 5) and update
any tiers that changed — same principle as `hydrateFactCoverage()`
(File 7), just applied across every section on the picker instead of
one active drill. Don't let the picker silently trust stale localStorage
forever, that's the exact bug this ticket's design note exists to fix.

## Verification

1. `node --check` on all new/modified `.cjs` files and `learn.js`.
2. `sass` compile / full `pnpm build`.
3. Manual review of the `chat-stream-core.ts` diff.
4. Via `netlify dev`: enter a section fresh. Confirm:
   - Teach screen shows with descriptions emphasized, price/tags muted.
   - The drill only ever asks ingredient-type questions during Basics,
     never dietary or pricing, even if you volunteer that information
     yourself in an answer.
   - `ITEM:`/`FACT_TYPE:`/`RESULT:` never leak into the visible
     transcript at any point during streaming.
5. Answer every item's ingredients correctly. Confirm:
   - The pass-transition banner fires exactly once, input disables,
     "Continue" routes back to the teach screen with price/tags now
     emphasized and description muted.
   - Clicking "Start practicing" again resumes the *same* conversation
     (chatHistory intact, doesn't restart), now only asking
     dietary/pricing questions.
6. Finish dietary + pricing for every item. Confirm:
   - The "Capable" banner fires (copy says Capable, not "learned").
   - `learn-progress/{userId}` in Firestore has the restaurant as the
     outer key, with every item under it showing all three fact types
     `true`.
   - Picker shows the section at the Capable tier.
7. Reload mid-Basics and mid-Complete (two separate test passes).
   Confirm the progress bar and pass both resume correctly in each case,
   not reset and not stuck on the wrong pass.
7b. **Restaurant isolation**: reach Capable on a section at one
   restaurant, then switch restaurants (Ticket 4's switcher) and drill
   the same-named section there if one exists. Confirm coverage starts
   at zero, not inherited from the other restaurant — this is the
   localStorage key (`lsCoverageKey`) and Firestore nesting doing their
   job, worth confirming directly rather than assuming from the schema
   alone.
7c. **Firestore-is-authoritative check** — the actual point of this
   ticket's design correction, don't skip this one. Cover a few facts in
   a section, confirm the progress bar reflects it, then clear this
   site's localStorage (devtools → Application → Clear storage, or just
   the one `tico-learn-coverage-*` key) and reload into that same
   section. Confirm the progress bar comes back showing the real
   coverage, fetched from Firestore, not reset to zero. If this shows
   zero after a cache clear, the read path isn't actually being trusted
   and the original bug is still there.
8. **Caching check**: with `ANTHROPIC_API_KEY` set, drill a few turns
   within the same pass and check Anthropic's response metadata
   (`cache_read_input_tokens`) — confirm blocks 1/2 show cache reads on
   turn 2+ within a pass. A pass *boundary* is an expected, acceptable
   cache miss on block 2 (the prompt text genuinely changes), turn-to-turn
   *within* a pass should not be.

## Prerequisite

None beyond what Tickets 1-4 already set up.
