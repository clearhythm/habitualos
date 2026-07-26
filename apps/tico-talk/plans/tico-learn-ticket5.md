# Ticket 5: /learn/ drill — deterministic item-coverage progress, tiered picker, per-turn context caching split

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket touches the same layers as Tickets 1-4: the shared streaming core
(`packages/edge-functions/chat-stream-core.ts`), the per-turn prompt
builder (`netlify/functions/learn-chat-init.cjs`), Firestore persistence
(`_services/`), and the drill's client-side rendering
(`src/assets/js/learn.js`).

**Depends on Tickets 1-4** — specifically Ticket 4's two-block cached
system prompt (`buildSharedPrompt`/`buildSectionPrompt`) and its
`restaurant-notes` collection with `scope`/`section` fields. This ticket
adds a third prompt block, removes Ticket 2/3's `mark_section_learned`
tool entirely, and **replaces** Ticket 3's boolean `learn-progress`
schema and checkmark-badge UI with per-item coverage. Build Ticket 4
first; this ticket's File 4 modifies the same `learn-chat-init.cjs` file
Ticket 4 just finished writing.

**Why this ticket exists**: live-testing exposed that `mark_section_learned`
was a single, vague, model-self-graded judgment call ("once you're
genuinely confident") with no visibility into progress along the way.
Discussed at length and landed on something more concrete: progress
should be **coverage-based**, not a confidence score. A section's bar
only ever goes up, in fixed increments, one per dish, the moment that
dish has been proven "sufficiently learned" by a rubric *we* define and
apply deterministically, not something the model self-assesses. This
also happens to simplify the architecture: no tool call is needed for
Learn's completion logic anymore.

**Existing data note**: any `learn-progress` docs from testing Ticket 3
use the old `{sectionName: true}` boolean shape. This ticket's new shape
is `{sectionName: {itemId: true, ...}}`, structurally incompatible.
Since this is still pre-launch (only Erik's testing data exists, not
real trainees), the plan is to accept that old test data becomes stale
rather than write a migration for it — confirm this is still true before
implementing; if real usage has started by then, this needs a real
migration step instead.

## Phase 0: Explore First

- `apps/tico-talk/netlify/functions/learn-chat-init.cjs` (as Ticket 4
  leaves it) — the two cached `systemMessages` blocks
  (`buildSharedPrompt`/`buildSectionPrompt`), the `tools` array, the
  `findSection`/`getMenuData`/`getRestaurantNotes` calls. This ticket
  adds a third block and removes `tools` entirely.
- `packages/edge-functions/chat-stream-core.ts` — specifically the
  `initBody` construction (already customized twice: `section` in Ticket
  2, unchanged since). This ticket adds `coveredItemIds` the same way.
  Same "sync the copy into `apps/tico-talk/netlify/edge-functions/_lib/`"
  step Tickets 2/3 already established applies again here.
- `apps/tico-talk/src/assets/js/learn.js` — `SEGMENT_MARKER_RE`,
  `createStreamRenderer()`, `renderAssistantTurn()` (Ticket 3's
  TICO:/GUEST: line-marker parser). This ticket extends the marker
  vocabulary to include `ITEM:`/`RESULT:` as a second, *hidden* marker
  type (parsed out, never rendered, unlike TICO:/GUEST: which each open
  a visible segment) — read that parser closely, this ticket's parser
  changes build directly on its "hold back a few characters, only act on
  a fully-resolved marker" approach rather than replacing it.
- `apps/tico-talk/netlify/functions/_services/db-learn-progress.cjs`
  (Ticket 3) — `markSectionLearned(userId, sectionName)` writes
  `{[sectionName]: true}`. This ticket's per-item write
  (`{[sectionName]: {[itemId]: true}}`) relies on `dbCore.create()`'s
  `{merge: true}` performing a **recursive** merge on nested map fields
  (confirmed Firestore behavior, not dot-notation paths) — verify this
  still holds while implementing rather than assuming from this ticket's
  memory of it.
- `apps/tico-talk/src/styles/_components.scss:237-262` — the *existing*
  4-dot skill-tree tier system (`.tier-dots`/`.tier-dot.is-filled`/
  `.tier-indicator__label`), and `apps/tico-talk/src/practice.njk:77-129`
  for how it's used today (Not started / Training / Capable / Natural /
  Mastered). This ticket reuses this exact visual language for Learn's
  picker instead of inventing a new one — Learn coverage alone can only
  ever grant up to **Capable**; Natural/Mastered stay tied to real
  Practice performance (a different, not-yet-built system, out of scope
  here).
- `apps/tico-talk/src/styles/_learn.scss` and `_competency-select.scss`
  — Ticket 3's `.learn-learned-banner` and `.competency-pill--learned`
  (checkmark modifier). The banner's trigger changes (coverage-derived
  instead of tool-fired) but the element itself stays. The checkmark
  modifier and its JS (`applyLearnedBadges`/`markSectionLearnedLocally`
  in `learn.js`) get **replaced** by the tier-dot readout below, not left
  in place alongside it.

## Overview

1. Extend the TICO:/GUEST: line-marker protocol (Ticket 3) with two more
   markers, `ITEM:`/`RESULT:`, emitted once per evaluation round,
   *hidden* from the transcript (parsed out, never rendered) — the
   model's way of reporting "this round was about dish X, and the answer
   was correct/partial/incorrect."
2. Client-side, deterministic coverage tracking: tally `RESULT: correct`
   per item, apply a fixed rubric (a single tunable constant, default:
   one clean correct answer covers an item), monotonic, never uncovers.
3. Drop the `mark_section_learned` tool entirely. Section-complete
   becomes client-computed (`coveredCount === totalCount`), no model
   judgment call involved.
4. `learn-chat-init.cjs` gains a third `systemMessages` block: current
   coverage state (what's covered, what's left), *not* cached
   (`cache_control` omitted), small, rebuilt fresh every turn — the two
   blocks Ticket 4 built stay fully cache-eligible since nothing dynamic
   lives in them anymore.
5. The client sends `coveredItemIds` with every turn (via
   `chat-stream-core.ts`'s `initBody`, same mechanism `section` already
   uses) so block 3 can be built fresh server-side each time.
6. `learn-progress` becomes per-item:
   `{sectionName: {itemId: true, ...}}`. Written incrementally, one
   small write per item the moment it's covered, not batched into
   Ticket 3's boundary-triggered chat-transcript flushes (those exist to
   avoid *expensive* per-turn writes of a whole transcript; a
   `{itemId: true}` write is cheap enough not to need that).
7. Live "X of N dishes covered" bar during the drill, and a tier-dot
   readout per section on the picker, replacing Ticket 3's flat
   checkmark badge.

**Design note — why this replaces the tool instead of adding a second
one**: an earlier version of this design (see the conversation this
ticket comes from) proposed the model self-report a 0-100 confidence
score every turn. Rejected as noisy and not something *we* control. The
version here has the model report two small, checkable facts per round
(which item, was the answer right) — closer to a classification task
than a judgment call, and the actual "is this section done" logic lives
entirely in our own code applying our own rubric to those facts, not in
the model deciding when it's confident enough.

**Design note — why a third, uncached block instead of folding coverage
into block 2**: raised directly during design. Anthropic's prompt
caching only reuses a cached prefix when it's byte-identical to a recent
previous call. If live coverage state lived inside Ticket 4's
section-specific block, that block's cache-eligibility would break on
*every single turn* of a conversation (since coverage changes turn to
turn), not just across different conversations — the exact kind of
tradeoff worth catching before it ships, not after. Splitting it into
its own tiny, deliberately uncached block keeps the expensive, static
parts (menu data, restaurant notes) cache-eligible while only the cheap,
small, actually-dynamic part gets reprocessed each turn.

**Design note — `learn-chat-init.cjs` is called every turn, not once**:
also raised directly during design, worth restating here since it's
exactly why this ticket's approach works at all. `chat-stream-core.ts`
calls the `initEndpoint` fresh on every POST to `/api/chat-stream`, not
just at conversation start — the edge function is stateless and the
whole conversation lives in client-sent `chatHistory`. The function's
*name* ("init") undersells what it actually does across every app that
uses this shared core, and doing this rename in our own code isn't in
scope (it's shared cross-app wiring), but **within this app's comments
and docs, refer to `learn-chat-init.cjs`'s role as building fresh turn
context, not one-time initialization** — call it `buildTurnContext`
conceptually wherever it's described, even though the file/endpoint
name itself stays `learn-chat-init.cjs` for consistency with the other
four apps' `*-chat-init.cjs` naming.

## File 1: `packages/edge-functions/chat-stream-core.ts` (MODIFY, shared)

Same pattern as `section` (Ticket 2) and its `toolBody` extension
(Ticket 3, now moot since there's no tool). Add `coveredItemIds` to the
`RequestBody` interface and pass it through to `initBody`:

```typescript
// RequestBody interface — add alongside `section`:
coveredItemIds?: string[]; // ADDED: item ids already covered this drill (tico-talk "learn" chat type)
```

```typescript
// In the handler, destructure alongside `section`:
coveredItemIds,

// In the initBody-building else branch:
} else {
  initBody = { userId, timezone, userName };
  if (replyToMomentId) initBody.replyToMomentId = replyToMomentId;
  if (section) initBody.section = section;
  if (coveredItemIds) initBody.coveredItemIds = coveredItemIds;
}
```

This is the shared file (not a per-app fork, confirmed during Ticket 2 —
all five apps copy the same canonical file at build time). Edit
`packages/edge-functions/chat-stream-core.ts` directly, then re-sync
`apps/tico-talk/netlify/edge-functions/_lib/chat-stream-core.ts` (the
committed local copy `netlify dev` reads) the same way Tickets 2/3 did.

## File 2: sync step

```bash
cp packages/edge-functions/chat-stream-core.ts apps/tico-talk/netlify/edge-functions/_lib/chat-stream-core.ts
```

Confirm `diff` shows no difference afterward, matching Tickets 2/3's
verification step.

## File 3: `netlify/functions/_services/db-learn-progress.cjs` (MODIFY)

Replace the whole-section boolean write with a per-item one. Keep
`getLearnProgress` as-is (still a point lookup by `userId`, the shape of
what it *returns* just changes upstream).

```javascript
// Before (Ticket 3):
exports.markSectionLearned = async (userId, sectionName) => {
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [sectionName]: true }
  });
};

// After:
/**
 * Mark one item within a section as covered for a user. Relies on
 * dbCore.create()'s {merge: true} performing a recursive merge on
 * nested map fields (confirmed Firestore behavior) — an existing doc's
 * other sections/items are untouched, only this one key gets added.
 * @param {string} userId
 * @param {string} sectionName
 * @param {string} itemId
 */
exports.markItemLearned = async (userId, sectionName, itemId) => {
  return dbCore.create({
    collection: COLLECTION,
    id: userId,
    data: { [sectionName]: { [itemId]: true } }
  });
};
```

Update the module's schema comment at the top from `{"Starters": true,
...}` to `{"Starters": {"chips-and-salsa": true, "guacamole": true},
...}`.

## File 4: `netlify/functions/learn-item-learned.cjs` (NEW)

Thin endpoint the client calls the moment an item flips to covered (not
batched into any boundary flush — this is cheap enough to write
immediately, unlike the full `learn-chats` transcript).

```javascript
const { markItemLearned } = require('./_services/db-learn-progress.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, section, itemId } = JSON.parse(event.body || '{}');
    if (!userId || !section || !itemId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, section, and itemId are required' }) };
    }

    await markItemLearned(userId, section, itemId);
    log('debug', '[learn-item-learned] covered', itemId, 'in', section, 'for', userId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    log('error', '[learn-item-learned] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

Fire-and-forget from the client (don't block the drill on this write
succeeding — the localStorage mirror, File 6, is the source of truth for
the current session regardless).

## File 5: `netlify/functions/learn-chat-init.cjs` (MODIFY)

Three changes: drop `tools`, add the third prompt block, filter
`getRestaurantNotes()`'s results by `scope` into the right blocks
(Ticket 4 wrote `buildSharedPrompt` to dump every note into the global
block regardless of scope — this ticket is what actually applies the
filter Ticket 4's design promised).

```javascript
const { getMenuData } = require('./_services/db-menu.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

function findSection(menuData, sectionName) {
  return menuData.categories.find((c) => c.name === sectionName) || null;
}

// buildSharedPrompt: filter to scope === 'restaurant' only.
function buildSharedPrompt(notes) {
  const restaurantNotes = notes.filter((n) => n.scope === 'restaurant');
  const notesBlock = restaurantNotes.length
    ? restaurantNotes.map((n) => `- ${n.text}`).join('\n')
    : '(none yet)';

  return `You are Tico, a warm, experienced coworker helping a restaurant server-in-training drill their knowledge of the menu.

The trainee is a server working the floor, not a host at the entrance. Every customer in this drill is already seated at a table, mid-visit. That means the trainee can and should take orders, make recommendations, and answer questions the way a server actually would. Never frame anything as out of scope for them because "that's the host's job" or "wait until they're seated," they're already seated.

RESTAURANT NOTES (apply across every section, equally authoritative to a section's menu data — these are staff-confirmed facts, not guesses):
${notesBlock}

Never use an em dash anywhere in your response, in either voice. Use a comma, period, or parentheses instead.`;
}

// buildSectionPrompt: filter notes to scope === 'section' && note.section === section.name,
// fold them into the section block (still cacheable per-section, nothing dynamic added here).
function buildSectionPrompt(section, notes) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { id: item.id, name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  const sectionNotes = notes.filter((n) => n.scope === 'section' && n.section === section.name);
  const sectionNotesBlock = sectionNotes.length
    ? `\nADDITIONAL NOTES FOR THIS SECTION (equally authoritative to SECTION DATA):\n${sectionNotes.map((n) => `- ${n.text}`).join('\n')}\n`
    : '';

  return `Drilling section: "${section.name}".

Each round works like this: you ask ONE question as if you were an ordinary seated customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question, or just placing an order). Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with one of "TICO:", "GUEST:", "ITEM:", or "RESULT:" (all caps, immediately followed by a colon and a space), marking what that line is.
- GUEST: the customer's own question or line of dialogue.
- TICO: everything that's you: narrating the scene, evaluating the trainee's answer, or any other aside.
- ITEM: only right before you evaluate an answer, one line, the id of the specific dish the question was about (use the "id" field from SECTION DATA below, e.g. "baja-fish-tacos").
- RESULT: only right after an ITEM: line, one line, one word: "correct", "partial", or "incorrect", your honest judgment of the trainee's answer to that item's question.

ITEM: and RESULT: lines are never shown to the trainee, they're just for tracking. Always emit them as a pair, right before your TICO: evaluation of an answer (never on the very first question of the drill, there's nothing to evaluate yet). Never put content from two different markers on the same line, and never skip a marker on a new line.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

SECTION DATA (${section.name} only):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
}

// NEW: uncached, per-turn coverage block.
function buildCoveragePrompt(section, coveredItemIds) {
  const covered = new Set(coveredItemIds || []);
  const remaining = section.items.filter((i) => !covered.has(i.id)).map((i) => i.id);
  const done = section.items.filter((i) => covered.has(i.id)).map((i) => i.id);

  if (remaining.length === 0) {
    return `CURRENT COVERAGE: every item in this section has already been covered (${done.join(', ') || 'none'}). Wrap up warmly, let the trainee know they've covered everything here, and don't manufacture new questions just to keep going.`;
  }

  return `CURRENT COVERAGE: still need to cover: ${remaining.join(', ')}.${done.length ? ` Already covered, don't re-drill unless it's genuinely useful: ${done.join(', ')}.` : ''} Prioritize what's not covered yet.`;
}

const tools = []; // no tools for Learn anymore — coverage is fully client-computed, see Ticket 5

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { section: sectionName, coveredItemIds } = JSON.parse(event.body || '{}');
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const [menuData, notes] = await Promise.all([getMenuData(), getRestaurantNotes()]);

    const section = findSection(menuData, sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(section, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildCoveragePrompt(section, coveredItemIds) } // no cache_control — deliberately uncached, changes every turn
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

Note `tools` is now an empty array rather than removed entirely from the
response — confirm `chat-stream-core.ts` handles an empty `tools` array
gracefully (it should: `tools: tools && tools.length > 0 ? tools : undefined`
in the shared core already guards against sending an empty array to
Anthropic), don't assume, verify while implementing.

## File 6: `src/assets/js/learn.js` (MODIFY)

The biggest file in this ticket. Four pieces: extend the marker parser,
track coverage, wire the progress bar, and send `coveredItemIds` with
every turn.

**Extend `SEGMENT_MARKER_RE`** to recognize all four marker types:

```javascript
// Before:
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST):[ \t]?/;

// After:
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST|ITEM|RESULT):[ \t]?/;
```

**Rework `createStreamRenderer()`** so segment content routes differently
depending on marker type — TICO/GUEST open a visible bubble as before
(unchanged real-time character-by-character feel); ITEM/RESULT
accumulate silently and only get processed once their segment closes
(next marker found, or `finalize()`), since they're short single-line
values with nothing to gain from partial rendering (there's nothing to
render, they're never shown):

```javascript
function createStreamRenderer(onItemResult) {
  let consumedLen = 0;
  let currentMarker = null; // 'TICO' | 'GUEST' | 'ITEM' | 'RESULT' | null
  let currentBubble = null;
  let currentBuffer = ''; // raw content of the segment currently being accumulated
  let pendingItemId = null;

  function closeCurrentSegment() {
    if (currentMarker === 'ITEM') {
      pendingItemId = currentBuffer.trim();
    } else if (currentMarker === 'RESULT') {
      const result = currentBuffer.trim();
      if (pendingItemId && result) onItemResult(pendingItemId, result);
      pendingItemId = null;
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

`SEGMENT_MARKER_HOLDBACK` stays `6` (still the longest marker, "GUEST:").

`renderAssistantTurn()` (rehydration path) needs the equivalent
ITEM:/RESULT:-skipping behavior — its current regex-position-scan
approach already iterates all markers found in the raw text; just skip
creating a segment element for `ITEM`/`RESULT` positions instead of only
handling `TICO`/`GUEST`. Rehydration does **not** need to re-derive
coverage from old messages, coverage is loaded from its own persisted
source (below), independently of chat history.

**Coverage tracking** — new state, alongside `chatHistory`/`currentChatId`:

```javascript
// ─── Item coverage ────────────────────────────────────────────────────
// Deterministic, our rubric, not the model's self-assessment. Tunable.
const CORRECT_ANSWERS_TO_COVER = 1;

let sectionItemIds = []; // all item ids in the current section, set in startDrill()
let coveredItemIds = new Set(); // monotonic — only ever grows
let correctCounts = {}; // itemId -> count of RESULT: correct seen this drill

function lsCoverageKey(section) {
  return `tico-learn-coverage-${section}`;
}

function loadCoverage(section) {
  try {
    const raw = localStorage.getItem(lsCoverageKey(section));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCoverage(section, covered) {
  try { localStorage.setItem(lsCoverageKey(section), JSON.stringify([...covered])); } catch {}
}

function updateProgressBar() {
  const total = sectionItemIds.length;
  const done = coveredItemIds.size;
  progressBar.style.setProperty('--progress', total ? `${(done / total) * 100}%` : '0%');
  progressBarLabel.textContent = `${done} of ${total} dishes covered`;
}

function handleItemResult(itemId, result) {
  if (!sectionItemIds.includes(itemId)) return; // model referenced an id we don't recognize — ignore, don't crash the tally
  if (coveredItemIds.has(itemId)) return; // already covered, monotonic
  if (result !== 'correct') return; // only clean correct answers count toward coverage in this rubric
  correctCounts[itemId] = (correctCounts[itemId] || 0) + 1;
  if (correctCounts[itemId] >= CORRECT_ANSWERS_TO_COVER) {
    coveredItemIds.add(itemId);
    saveCoverage(currentSection, coveredItemIds);
    updateProgressBar();
    fetch('/api/learn-item-learned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getOrCreateUserId(), section: currentSection, itemId })
    }).catch(() => {}); // fire-and-forget — localStorage is this session's source of truth regardless
    if (coveredItemIds.size === sectionItemIds.length) {
      showLearnedBanner();
      markSectionLearnedLocally(currentSection); // Ticket 3's picker-badge mirror — repurposed below, see File 7
      applyLearnedBadges();
    }
  }
}
```

**Wire it into `sendTurn()`**: pass `handleItemResult` into
`createStreamRenderer()`, and include `coveredItemIds` in the request
body:

```javascript
// Before:
const renderer = createStreamRenderer();
...
body: JSON.stringify({
  chatType: 'learn',
  userId: getOrCreateUserId(),
  message,
  chatHistory,
  section: currentSection
})

// After:
const renderer = createStreamRenderer(handleItemResult);
...
body: JSON.stringify({
  chatType: 'learn',
  userId: getOrCreateUserId(),
  message,
  chatHistory,
  section: currentSection,
  coveredItemIds: [...coveredItemIds]
})
```

**`startDrill()`**: set `sectionItemIds` from the section's menu data
(needs it client-side now — check whether `learn.njk`'s picker/teach
markup already exposes each section's item ids somewhere in the DOM via
`data-*` attributes, or whether this needs a small new endpoint/embedded
JSON; the menu data itself lives in Firestore as of Ticket 4, not
statically importable into a browser module the way `require()` could
before — this is the one piece of this ticket most likely to need a
judgment call while implementing), and load persisted coverage instead
of Ticket 3's simple existing/absent chat check alone:

```javascript
function startDrill() {
  coveredItemIds = loadCoverage(currentSection);
  correctCounts = {};
  updateProgressBar();
  // ...existing loadSectionState()/rehydration logic, unchanged...
}
```

**Remove**: Ticket 3's `markSectionLearnedLocally`/`applyLearnedBadges`
functions stay (repurposed for the tier-dot picker, see File 7) but their
*trigger* changes from the deleted tool's `learned` flag to
`handleItemResult`'s coverage-complete check above. The old
`tool_complete`/`mark_section_learned` branch in `sendTurn`'s SSE-parsing
loop gets deleted outright (there's no tool anymore, `chat-stream-core.ts`
won't send a `tool_complete` event for Learn at all now that `tools` is
empty).

## File 7: `src/learn.njk` (MODIFY)

Progress bar element in the drill (flex-shrink:0, alongside the back
link, above the scrolling transcript):

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

Picker pills gain a tier-dot readout, replacing the checkmark modifier —
exact markup depends on whatever's cleanest once the tier-dot component
is in front of you (it may be worth extracting a Nunjucks macro shared
with `practice.njk`'s existing skill-tree-row tier-indicator rather than
copy-pasting the dot markup, implementer's call, but don't duplicate
the visual system, reuse `.tier-dots`/`.tier-dot`/`.tier-indicator__label`
as-is):

```html
<button class="competency-pill" data-section="{{ category.name }}">
  {{ category.name }}
  <span class="tier-dots" data-tier-dots></span>
</button>
```

## File 8: `src/styles/_learn.scss` and `_competency-select.scss` (MODIFY)

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
```

Remove `.competency-pill--learned` (superseded by the tier-dot readout,
not left dead in the stylesheet) from `_competency-select.scss`. The
`.tier-dots`/`.tier-dot`/`.tier-indicator__label` rules already exist in
`_components.scss` and need no changes, just reuse.

Client-side, computing which tier a section's pill shows (0 covered =
Not started, 1 to n-1 covered = Training, all covered = Capable) is
straightforward arithmetic on the same per-section coverage data
`applyLearnedBadges()` already reads from localStorage — extend that
function to set dot-fill state instead of (or alongside, during
transition) the old checkmark class.

## Verification

1. `node --check` on all new/modified `.cjs` files and `learn.js`.
2. `sass` compile / full `pnpm build`.
3. Manual review of the `chat-stream-core.ts` diff (no TypeScript build
   step to lean on).
4. Via `netlify dev`: drill a section, answer a couple of questions
   correctly. Confirm:
   - The progress bar advances only on genuinely correct answers, in
     discrete steps (one item at a time), never partial/fractional
     jumps mid-item.
   - `ITEM:`/`RESULT:` never leak into the visible transcript, at any
     point during streaming (not even briefly before the marker
     resolves, given the holdback logic).
   - Tico's questions cover *different* dishes across rounds rather than
     repeating the same one or two, and once a couple of items are
     covered, it prioritizes what's left over what's already covered.
5. Answer every item in a small section (fewer dishes = faster to fully
   verify) until coverage hits 100%. Confirm:
   - The learned banner still fires, now via coverage instead of a tool.
   - `learn-progress/{userId}` in Firestore now has
     `{sectionName: {itemId: true, ...}}` for every item, not a bare
     boolean.
   - The picker shows the section at the "Capable" tier (however many
     dots that maps to on the existing 4-dot scale).
6. Reload mid-drill (after covering some but not all items). Confirm the
   progress bar picks back up at the right count, not reset to zero and
   not lost.
7. **Caching check** (the actual point of File 1/5's split): with
   `ANTHROPIC_API_KEY` set, drill the same section for a few turns and
   check Anthropic's usage/response metadata (`cache_read_input_tokens`,
   available in the API response) — confirm blocks 1/2 show cache reads
   on turn 2+ of the same conversation, not just cache writes on turn 1.
   This is the one thing unit-testing the code can't catch, has to be
   observed against the real API.

## Prerequisite

None beyond what Tickets 1-4 already set up.
