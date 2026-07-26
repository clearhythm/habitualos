# Ticket 4: /learn/ drill — DB-backed menu data, restaurant notes, live corrections

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). Backend:
Netlify Functions (Node.js CommonJS). Database: Google Firestore via
`@habitualos/db-core`, already wired up in Ticket 3. Frontend: 11ty +
Nunjucks (static site generation at build time) + vanilla JS ES modules
(runtime, in the browser). AI: `@anthropic-ai/sdk`, already a
`package.json` dependency (used by the old, now-deleted `learn-drill.cjs`;
not currently used by anything live, since Ticket 2 moved the drill
itself to the streaming edge-function architecture instead).

**Depends on Tickets 1-3** — the drill UI, streaming backend, and
Firestore persistence layer (`_services/`, `learn-progress`, `learn-chats`)
all already exist and are unaffected by this ticket. This ticket adds new
Firestore-backed data sources feeding into `learn-chat-init.cjs`'s system
prompt, plus a new correction-capture UI element.

**Why this ticket exists**: live-testing Ticket 3 surfaced a real gap.
Tico correctly refuses to state anything not in `SECTION DATA`
(`src/_data/menus/margaritaville.json`, loaded via `require()`) — that's
working as designed. But the menu file is necessarily incomplete (it's a
menu, not an operations manual), so Tico sometimes tells a trainee
something is unconfirmed when a real staff member already knows
otherwise (e.g. "we don't have hot sauce as an add-on" when the
restaurant does, in fact, keep hot sauces on hand). The fix isn't to make
Tico less careful, it's to give it a way to *learn* facts live, from the
people using it, without needing a code deploy.

## Phase 0: Explore First

- `apps/tico-talk/netlify/functions/learn-chat-init.cjs` — current
  `require()` of the static JSON, `findSection()`, `buildSystemPrompt()`.
  This ticket changes where the menu data comes from and adds a second
  data source; read it fully before touching it.
- `apps/tico-talk/src/_data/menus/margaritaville.json` — the file being
  migrated. Note its exact top-level shape: `{venueId, name, categories:
  [{name, items: [{id, name, description, price, tags, allergens,
  notes}]}]}`. 14 categories today.
- **Eleventy's data cascade**: `src/_data/menus/margaritaville.json` is
  not only `require()`'d by `learn-chat-init.cjs` — Eleventy
  automatically loads every file under `src/_data/` as global template
  data (exposed as `menus` in templates), which is how `menu.njk`,
  `drinks.njk`, `menu-review.njk`, and `learn.njk`'s picker all render
  today with zero explicit imports, via `{% for menu in menus %}`. **This
  means the static file can't just be deleted** — see File 2 below for
  how this ticket handles it (converting it to an async data file that
  reads from Firestore at build time, so both the static pages and the
  chat prompt end up reading the same one source of truth, rather than
  the runtime prompt reading from Firestore while the pages keep reading
  a separately-drifting static copy).
- `packages/db-core/db-core.cjs` — reused from Ticket 3, same API
  (`create`, `get`, `query`, `uniqueId`). No new package-level work
  needed here.
- `apps/tico-talk/.env`'s `FIREBASE_ADMIN_CREDENTIALS` — already set up
  in Ticket 3, reused here. **New requirement**: for real Netlify builds
  (not just `netlify dev`), this same var needs to be available at
  *build* time too, since File 2 below makes the 11ty build itself read
  from Firestore. Ticket 3 already flagged "the same var needs to be set
  in Netlify's site config too" as future work; this ticket is what
  actually needs it. Not blocking local work (`netlify dev` and `pnpm
  build` both already load `.env` locally), but worth doing before an
  actual production deploy.
- `apps/dreamscape/src/reflect.njk:36-49` and
  `apps/dreamscape/src/styles/_components.scss:1957-2002` — the
  `.chat-input-toolbar` / `.chat-toolbar-btn` / `.chat-send-btn` pattern:
  quiet, low-contrast icon buttons (`rgba($color-text, 0.25)`, transparent
  background) on the left for secondary actions (start-fresh, save-chat),
  versus the bold filled `.chat-send-btn` on the right. This ticket's flag
  button follows the *quiet* treatment, explicitly less visually heavy
  than `.learn-send-btn` (Ticket 1's solid green send button) — confirmed
  against a live screenshot of dreamscape's actual composer during
  design discussion.
- `apps/dreamscape/src/styles/_components.scss:2071-2103` — the generic
  `[data-tooltip]` utility (an `::after` pseudo-element rendering
  `attr(data-tooltip)` on hover/focus-visible). Those same toolbar
  buttons use `data-tooltip="Start a fresh conversation"` etc. to label
  themselves on hover, since icon-only buttons need it. tico-talk has no
  equivalent utility yet — this ticket adds one (generic, not scoped to
  the flag button specifically, so it's there for any future icon button
  in the app) alongside the flag button that uses it.
- `apps/tico-talk/src/learn.njk` and `src/assets/js/learn.js` — the
  `.learn-input-toolbar`/`.learn-send-btn` currently holds only the send
  button, right-aligned via `justify-content: flex-end`. This ticket adds
  a second, left-aligned button, so that becomes `justify-content:
  space-between` (matching dreamscape's toolbar).
- `apps/tico-talk/src/styles/_learn.scss` — where the new flag-button and
  correction-card styles land, alongside Ticket 1/3's existing rules.

## Overview

1. Move menu data to Firestore as the single source of truth, read at
   *build time* by Eleventy (for the static pages) and cached in memory
   at *runtime* by `learn-chat-init.cjs` (for the chat prompt) — not two
   independently-drifting copies.
2. Add a `restaurant-notes` Firestore collection: freeform,
   restaurant-wide facts (not scoped to a menu section), included in
   *every* drill's system prompt alongside the section's menu data, with
   the HARD RULE extended to trust both equally.
3. Add a "flag" button to the drill's input toolbar (quiet/secondary
   styling, left-aligned, opposite the bold send button) that lets
   whoever's drilling say "what I just said was actually right" without
   retyping it — the system extracts the claim from the exchange, they
   confirm or edit it, and it's saved as a new restaurant note,
   immediately available for the rest of the session (and to other
   sessions once their function instance's cache refreshes).

**Design note — why a build-time data file for the menu, not just a
runtime fetch**: the ticket could have stopped at "make
`learn-chat-init.cjs` read from Firestore" and left the static pages
reading the committed JSON. That's simpler, but creates two sources of
truth that will silently drift the first time someone updates one and
forgets the other — exactly what Erik asked to avoid ("one source of
truth in the DB"). Converting the Eleventy data file itself to an async
Firestore read closes that gap at the cost of the production build
depending on Firestore being reachable at deploy time (not just at
request time) — a real tradeoff, noted here rather than decided
silently, but the right call given the stated goal.

**Design note — restaurant notes are global, not per-section**: this was
explicitly reconsidered mid-design. A first instinct was to scope
corrections to the section being drilled (`learn-section-notes`), but "we
have hot sauce" isn't a Tacos fact, it's true regardless of which section
someone's drilling. `restaurant-notes` is one flat collection, included
in every section's prompt, not filtered by section.

**Design note — extract, don't ask for retyping**: the first UX draft for
corrections was a free-text box ("type a clarification or new rule").
Rejected as too much friction — the trainee already typed the correct
fact once, in the flow of guest-facing dialogue. The flag button instead
sends the last exchange to a small extraction call that proposes a clean,
standalone version of what they already said, and they just confirm,
edit, or reject it.

## File 1: One-time Firestore seed (run once, not part of the app)

Not a committed file — a throwaway script run locally once to copy the
existing JSON into Firestore. Something like:

```javascript
require('dotenv').config();
const dbCore = require('@habitualos/db-core');
const menuData = require('./src/_data/menus/margaritaville.json');

dbCore.create({
  collection: 'restaurant-config',
  id: 'menu',
  data: menuData
}).then((r) => console.log('seeded:', r)).catch((e) => { console.error(e); process.exit(1); });
```

Run with `node -e "..."` or as a temporary `.cjs` file, from
`apps/tico-talk`, then delete it. Confirm via Firestore console (or a
quick `dbCore.get`) that `restaurant-config/menu` now holds the full
object before moving on to File 2/3, which assume it's already there.

## File 2: `src/_data/menus/margaritaville.js` (REPLACES `margaritaville.json`)

Eleventy supports JS data files that export an async function — this
becomes the single source both the static pages and the runtime prompt
ultimately read from (the runtime side goes through File 3's cache
instead of hitting Firestore on every request, but it's the same
Firestore doc).

```javascript
const dbCore = require('@habitualos/db-core');

module.exports = async function () {
  const menu = await dbCore.get({ collection: 'restaurant-config', id: 'menu' });
  if (!menu) throw new Error('restaurant-config/menu not found in Firestore — run the seed script (Ticket 4, File 1) first.');
  return menu;
};
```

Delete `margaritaville.json` once this is confirmed working (`git rm`,
not just leaving it to rot unreferenced — nothing will `require()` it
anymore after this file and File 3 land). Eleventy's data cascade doesn't
care about the `.js` vs `.json` extension change, `menus` continues to
resolve the same way in every template that already uses it
(`menu.njk`, `drinks.njk`, `menu-review.njk`, `learn.njk`'s picker) —
confirm this while implementing (Eleventy caches data-file results per
build, so this is one Firestore read per `pnpm build`, not per page).

## File 3: `netlify/functions/_services/db-menu.cjs` (NEW)

The *runtime* counterpart to File 2 — same Firestore doc, but read (and
cached in memory) from inside a Netlify Function's execution, which is a
completely separate process/lifecycle from the Eleventy build. Mirrors
the "load once per cold start, reuse across requests on that same warm
instance" behavior the old `require()` gave for free.

```javascript
//
// netlify/functions/_services/db-menu.cjs
// ------------------------------------------------------
// Cached accessor for the menu data Firestore doc (restaurant-config/menu).
// Same document Eleventy reads at build time (src/_data/menus/margaritaville.js)
// — this is the runtime (Netlify Function) side, cached per warm instance
// so a chat turn doesn't cost a Firestore read on top of the Anthropic call.
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

let cached = null;

exports.getMenuData = async () => {
  if (cached) return cached;
  const menu = await dbCore.get({ collection: 'restaurant-config', id: 'menu' });
  if (!menu) throw new Error('restaurant-config/menu not found in Firestore.');
  cached = menu;
  return cached;
};
```

No cache-invalidation path here deliberately — menu data changing is
rare and not this ticket's concern (unlike restaurant notes, which are
meant to change live). If the menu needs to change, redeploy (which
recycles function instances) or wait for natural instance recycling.

## File 4: `netlify/functions/_services/db-restaurant-notes.cjs` (NEW)

Same caching shape as File 3, but adds a write path, and the cache gets
updated (not just invalidated) on write so the *same* warm instance sees
a just-confirmed correction immediately, without waiting for a fresh
Firestore read.

**Scope, decided during design, not left for Ticket 5 to bolt on**: a
note is either `scope: 'restaurant'` (true regardless of section, e.g.
"hot sauce is available on request") or `scope: 'section'` + `section:
'<name>'` (true only within that section, e.g. something specific to the
nachos). The *model* decides which, per correction (see File 6) — it
already knows which section is being drilled when a correction is
proposed, so it doesn't need to guess the section name, just classify
scope. `getRestaurantNotes()` returns everything; callers filter by scope
(Ticket 5's prompt-building code splits them into the right cache
blocks — restaurant-wide notes are section-independent so they belong in
the globally-shared block, section-scoped notes belong in that section's
own block).

Dish-level precision (a fact tied to one specific menu item, not just a
section) was considered and deliberately deferred — that would mean
writing into the item's own `notes` field in the canonical menu data
(File 2) rather than this additive notes list, a more sensitive edit
than this ticket's flag-and-confirm flow is meant for. Two tiers
(restaurant / section) is the right scope for now.

```javascript
//
// netlify/functions/_services/db-restaurant-notes.cjs
// ------------------------------------------------------
// Freeform facts that supplement the menu data in every /learn/ drill's
// system prompt. Two scopes:
//   - 'restaurant': true regardless of section (e.g. "hot sauce is
//     available on request") — included in every drill.
//   - 'section': true only within one section (e.g. something specific
//     to the nachos) — included only when that section is being drilled.
// Added live via the flag-and-confirm correction flow (Files 6-7), not
// edited through a deploy. The model classifies scope at correction time
// (File 6) since it already has the current section as context.
//
// Schema:
//   restaurant-notes/{noteId}
//   {
//     text: string,
//     scope: 'restaurant' | 'section',
//     section: string | null, // set only when scope === 'section'
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'restaurant-notes';

let cached = null; // Array<{id, text, scope, section}> | null

exports.getRestaurantNotes = async () => {
  if (cached) return cached;
  const notes = await dbCore.query({ collection: COLLECTION });
  cached = notes;
  return cached;
};

/**
 * Add a new restaurant note and update the in-memory cache immediately
 * (not just invalidate it) so this same warm instance's next prompt
 * build already includes it — see Ticket 4's note on cross-instance
 * propagation being eventually-consistent, not instant everywhere.
 * @param {string} text
 * @param {{scope: 'restaurant'|'section', section?: string}} classification
 */
exports.addRestaurantNote = async (text, { scope, section = null }) => {
  const data = { text, scope, section: scope === 'section' ? section : null };
  const { id } = await dbCore.create({ collection: COLLECTION, data });
  const note = { id, ...data };
  cached = cached ? [...cached, note] : [note];
  return note;
};
```

## File 5: `netlify/functions/learn-chat-init.cjs` (MODIFY)

Replace the static `require()` with File 3/4's cached getters, and add
restaurant notes as a second, separately-cached system message block
(splitting them from the section-specific block means the *shared*
restaurant-notes-plus-framing prefix can hit Anthropic's prompt cache
across different sections and different trainees, not just across turns
of the same conversation — the section-specific menu data still varies
per drill, so it stays as its own block).

```javascript
const { getMenuData } = require('./_services/db-menu.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

function findSection(menuData, sectionName) {
  return menuData.categories.find((c) => c.name === sectionName) || null;
}

function buildSharedPrompt(notes) {
  const notesBlock = notes.length
    ? notes.map((n) => `- ${n.text}`).join('\n')
    : '(none yet)';

  return `You are Tico, a warm, experienced coworker helping a restaurant server-in-training drill their knowledge of the menu.

The trainee is a server working the floor, not a host at the entrance. Every customer in this drill is already seated at a table, mid-visit. That means the trainee can and should take orders, make recommendations, and answer questions the way a server actually would. Never frame anything as out of scope for them because "that's the host's job" or "wait until they're seated," they're already seated.

RESTAURANT NOTES (apply across every section, equally authoritative to the section's menu data below — these are staff-confirmed facts, not guesses):
${notesBlock}

Never use an em dash anywhere in your response, in either voice. Use a comma, period, or parentheses instead.`;
}

function buildSectionPrompt(section) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  return `Drilling section: "${section.name}".

Each round works like this: you ask ONE question as if you were an ordinary seated customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question, or just placing an order). Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with either "TICO:" or "GUEST:" (all caps, immediately followed by a colon and a space), marking who's speaking that line. Use GUEST: for the customer's own question or line of dialogue. Use TICO: for everything that's you: narrating the scene, evaluating the trainee's answer, or any other aside. Never put GUEST and TICO content on the same line, and never skip the marker on a new line.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES above. If something isn't in either, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly, across however many customer interactions it takes, that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer, wait for real, repeated, demonstrated recall.

SECTION DATA (${section.name} only):
${JSON.stringify(trimmedItems, null, 2)}

Follow the TICO:/GUEST: format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
}

const tools = [
  {
    name: 'mark_section_learned',
    description: 'Call this once the trainee has demonstrated solid, repeated recall for this section — not on the first correct answer alone.',
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { section: sectionName } = JSON.parse(event.body || '{}');
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
      { type: 'text', text: buildSectionPrompt(section), cache_control: { type: 'ephemeral' } }
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

Note the split versus the original single-block prompt: `buildSharedPrompt`
now carries the framing that used to open `buildSectionPrompt` (the "you
are Tico" intro, the server-role paragraph, the em-dash rule) since none
of that varies by section either — only the section-specific drilling
mechanics and SECTION DATA stay in the second block.

**This file gets revisited in Ticket 5**, which adds a third (uncached,
per-turn) prompt block for live item-coverage state, filters
`getRestaurantNotes()`'s results by `scope` into the two cached blocks
above instead of dumping everything into `buildSharedPrompt`, drops the
`mark_section_learned` tool entirely in favor of a deterministic
client-side coverage check, and renames this function's *conceptual*
role in comments to reflect that it builds fresh context every turn, not
just once. Nothing here is wasted work, Ticket 5 builds on this shape,
it just isn't the final state of this file.

## File 6: `netlify/functions/learn-propose-correction.cjs` (NEW)

Plain, non-streaming Anthropic call (this app already depends on
`@anthropic-ai/sdk` in `package.json`, unused since `learn-drill.cjs` was
deleted in Ticket 2 — this is the first thing to use it again). Not part
of `chat-stream-core.ts`, this isn't a chat turn, it's a one-shot
extraction utility.

The extraction also classifies scope (restaurant-wide vs. this section
only) in the same call, so the trainee doesn't have to pick it manually —
per design discussion, the model can reasonably infer this ("hot sauce"
generalizes, something about the nachos' specific preparation doesn't).
`currentSection` comes from the client, which already knows it.

```javascript
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { log } = require('./_utils/log.cjs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { lastUserMessage, lastAssistantMessage, currentSection } = JSON.parse(event.body || '{}');
    if (!lastUserMessage || !lastAssistantMessage || !currentSection) {
      return { statusCode: 400, body: JSON.stringify({ error: 'lastUserMessage, lastAssistantMessage, and currentSection are required' }) };
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are extracting a factual correction from a restaurant staff training exchange. The trainee (a real server) said something Tico (their AI coach) disputed or wasn't confident about, but the trainee actually knows better since they work there. The trainee was drilling the "${currentSection}" section when this happened.

TRAINEE SAID: "${lastUserMessage}"
TICO RESPONDED: "${lastAssistantMessage}"

Extract the specific factual claim the trainee made, phrased as a single, standalone, declarative sentence suitable for a restaurant knowledge base entry (not guest-facing dialogue, not a direct quote, no em dashes). Also classify it: is this true restaurant-wide (e.g. "hot sauce is available on request" applies no matter what's being ordered), or specific to the "${currentSection}" section (e.g. something true of one dish or a handful of related items, not the restaurant generally)?

Respond with ONLY a JSON object, no markdown fences, no other text: {"fact": "...", "scope": "restaurant" or "section"}`
      }]
    });

    const raw = response.content[0]?.text?.trim() || '{}';
    const { fact, scope } = JSON.parse(raw);
    if (!fact || !['restaurant', 'section'].includes(scope)) {
      throw new Error(`Unexpected extraction shape: ${raw}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedFact: fact, proposedScope: scope })
    };
  } catch (error) {
    log('error', '[learn-propose-correction] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

## File 7: `netlify/functions/learn-save-correction.cjs` (NEW)

```javascript
const { addRestaurantNote } = require('./_services/db-restaurant-notes.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { text, scope, section } = JSON.parse(event.body || '{}');
    if (!text || !text.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'text is required' }) };
    }
    if (!['restaurant', 'section'].includes(scope)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'scope must be "restaurant" or "section"' }) };
    }
    if (scope === 'section' && !section) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required when scope is "section"' }) };
    }

    const note = await addRestaurantNote(text.trim(), { scope, section });
    log('debug', '[learn-save-correction] saved note', note.id, 'scope:', scope);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, note }) };
  } catch (error) {
    log('error', '[learn-save-correction] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

## File 8: `src/learn.njk` (MODIFY)

Add the flag button to the toolbar, before the send button:

```html
<!-- Before -->
<div class="learn-input-toolbar">
  <button type="submit" id="learn-send-btn" class="learn-send-btn" disabled aria-label="Send">
    ...
  </button>
</div>

<!-- After -->
<div class="learn-input-toolbar">
  <button type="button" id="learn-flag-btn" class="learn-toolbar-btn" disabled aria-label="Flag last correction as right" data-tooltip="Tell Tico you were right">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <path d="M4 22V15"/>
    </svg>
  </button>
  <button type="submit" id="learn-send-btn" class="learn-send-btn" disabled aria-label="Send">
    ...
  </button>
</div>
```

Also add a placeholder container right after `.learn-transcript-scroll`
(sibling of `.learn-input-shell`, same spot `.learn-learned-banner` uses)
for the confirmation card, or just have File 9's JS insert/remove it
directly into the transcript flow the same way the learned banner does —
implementer's call, matching whichever existing pattern reads cleaner
once File 9's actual card markup is in front of you.

## File 9: `src/assets/js/learn.js` (MODIFY)

Wire the button: enabled once there's a completed exchange to reference,
click sends the last user+assistant turn to the propose endpoint, renders
a confirm/edit/reject card, and on confirm posts to the save endpoint.

```javascript
const flagButton = document.getElementById('learn-flag-btn');

function updateFlagButton() {
  // Enabled once there's at least one full user+assistant exchange —
  // chatHistory alternates {role:'user'}, {role:'assistant'}, ...
  flagButton.disabled = chatHistory.length < 2;
}

function lastExchange() {
  const assistantIdx = [...chatHistory].reverse().findIndex((m) => m.role === 'assistant');
  if (assistantIdx === -1) return null;
  const assistant = chatHistory[chatHistory.length - 1 - assistantIdx];
  const userBefore = chatHistory.slice(0, chatHistory.length - 1 - assistantIdx).reverse().find((m) => m.role === 'user');
  if (!userBefore) return null;
  return { lastUserMessage: userBefore.content, lastAssistantMessage: assistant.content };
}

function showCorrectionCard(proposedFact, proposedScope) {
  const card = document.createElement('div');
  card.className = 'learn-correction-card';
  card.dataset.scope = proposedScope; // 'restaurant' | 'section'
  const scopeLabel = proposedScope === 'restaurant' ? 'Restaurant-wide' : `${currentSection}-specific`;
  card.innerHTML = `
    <p class="learn-correction-card__label">Save this as a fact Tico should know?</p>
    <p class="learn-correction-card__scope">${scopeLabel}</p>
    <p class="learn-correction-card__text"></p>
    <div class="learn-correction-card__actions">
      <button type="button" class="btn-quiet" data-action="no">No</button>
      <button type="button" class="btn-quiet" data-action="edit">Edit</button>
      <button type="button" class="btn" data-action="yes">Yes, save it</button>
    </div>
  `;
  card.querySelector('.learn-correction-card__text').textContent = proposedFact;
  transcript.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });

  card.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'no') {
      card.remove();
    } else if (action === 'edit') {
      const textEl = card.querySelector('.learn-correction-card__text');
      const editInput = document.createElement('textarea');
      editInput.className = 'learn-correction-card__edit';
      editInput.value = textEl.textContent;
      textEl.replaceWith(editInput);
      e.target.remove(); // remove the Edit button itself once editing starts
    } else if (action === 'yes') {
      const textEl = card.querySelector('.learn-correction-card__text, .learn-correction-card__edit');
      const finalText = textEl.value ?? textEl.textContent;
      card.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        await fetch('/api/learn-save-correction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: finalText, scope: card.dataset.scope, section: currentSection })
        });
        card.querySelector('.learn-correction-card__label').textContent = 'Saved, Tico will know this going forward.';
        card.querySelectorAll('.learn-correction-card__actions button').forEach((b) => b.remove());
      } catch {
        card.querySelector('.learn-correction-card__label').textContent = 'Couldn’t save just now, try again in a moment.';
        card.querySelectorAll('button').forEach((b) => (b.disabled = false));
      }
    }
  });
}

flagButton?.addEventListener('click', async () => {
  const exchange = lastExchange();
  if (!exchange) return;
  flagButton.disabled = true;
  try {
    const response = await fetch('/api/learn-propose-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...exchange, currentSection })
    });
    const data = await response.json();
    if (data.proposedFact) showCorrectionCard(data.proposedFact, data.proposedScope);
  } finally {
    updateFlagButton();
  }
});
```

Call `updateFlagButton()` everywhere `chatHistory` changes — alongside
the existing `updateSendButton()` calls after a turn completes, and reset
it (disabled) in `startDrill()` for a fresh section. The correction card
shows the model's scope classification as a small label so the trainee
can see (and implicitly sanity-check) it before confirming — there's no
separate "change the scope" control in this v1, if the classification is
wrong the trainee's only recourse is "No" and re-flagging isn't
supported; edit only changes the fact text, not its scope. Worth
revisiting if that turns out to matter in practice.

Note `lastAssistantMessage`/`lastUserMessage` here are the **raw**
stored text (assistant messages still carry the TICO:/GUEST: markers,
per Ticket 3's rehydration design) — that's fine, the extraction prompt
in File 6 doesn't need it marker-free, the model handles it either way,
but worth confirming while implementing rather than assuming.

## File 10: `src/styles/_learn.scss` (MODIFY)

```scss
.learn-input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between; // was flex-end — now flag (left) + send (right)
  padding: 0.2rem 0.4rem 0.3rem;
}

// Quiet, secondary treatment — deliberately less visually heavy than
// .learn-send-btn's solid green fill. Mirrors dreamscape's
// .chat-toolbar-btn (start-fresh/save-chat icons).
.learn-toolbar-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba($color-text, 0.3);
  padding: 0.3rem;
  display: flex;
  align-items: center;
  line-height: 1;
  border-radius: 6px;
  transition: color 0.2s;

  &:hover:not(:disabled) { color: rgba($color-text, 0.7); }
  &:disabled { opacity: 0.4; cursor: default; }
}

.learn-correction-card {
  text-align: center;
  padding: $space-md;
  margin: $space-md $space-lg 0;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: 0.75rem;
}

.learn-correction-card__label {
  font-size: $font-size-sm;
  color: $color-text-muted;
  margin: 0 0 $space-sm;
}

.learn-correction-card__scope {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  color: $color-green;
  border: 1px solid $color-green;
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  margin: 0 0 $space-sm;
}

.learn-correction-card__text {
  font-weight: 600;
  margin: 0 0 $space-md;
}

.learn-correction-card__edit {
  width: 100%;
  min-height: 4rem;
  margin: 0 0 $space-md;
  padding: $space-sm;
  border: 1px solid $color-border;
  border-radius: 0.5rem;
  font-family: $font-family;
  font-size: $font-size-base;
  resize: vertical;
}

.learn-correction-card__actions {
  display: flex;
  justify-content: center;
  gap: $space-sm;
}

// Generic hover/focus tooltip for any icon-only button — not scoped to
// .learn-toolbar-btn specifically. Mirrors dreamscape's [data-tooltip]
// utility (_components.scss:2071-2103) adapted to tico-talk's light
// theme: dark chip, readable regardless of what's underneath, rather
// than dreamscape's light-on-dark version.
[data-tooltip] {
  position: relative;

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: rgba($color-text, 0.92);
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 100;
  }

  &:hover::after,
  &:focus-visible::after {
    opacity: 1;
  }
}
```

This is a generic, app-wide utility (the `[data-tooltip]` attribute
selector isn't scoped to `.learn-toolbar-btn`) — reasonable to place in
`_components.scss` instead of `_learn.scss` if that reads better once
it's in front of you, since nothing about it is Learn-specific; either
location works, just don't duplicate it if `_components.scss` already
has something similar by the time this is implemented.

`.btn-quiet` is referenced in File 9's markup — confirm it already
exists app-wide (it's used in dreamscape's ready-overlay per earlier
exploration; check whether tico-talk already has an equivalent or needs
one added, before assuming it's free).

## Verification

1. `node --check` on all new/modified `.cjs` files, and the modified
   `learn.js`.
2. `sass` compile / full `pnpm build`.
3. Run the File 1 seed script once, confirm `restaurant-config/menu`
   exists in Firestore (console or `dbCore.get`).
4. `pnpm build` (or `netlify dev`, which also triggers an Eleventy build)
   — confirm `/menu/`, `/drinks/`, `/menu-review/`, and `/learn/`'s picker
   all still render correctly now that `margaritaville.js` reads from
   Firestore instead of the deleted `.json` file. This is the step most
   likely to break silently (a typo'd collection/id, a missing await)
   since a broken data file can fail the *entire* Eleventy build, not
   just the `/learn/` page.
5. Via `netlify dev`: drill a section, confirm Tico still behaves
   correctly (references real menu data, refuses facts not in either
   data source).
6. Say something true but unconfirmed (e.g. bring up hot sauce
   availability) and let Tico dispute it, matching the original bug
   report. Click the flag button. Confirm:
   - It's disabled until this exchange exists, and re-disables while the
     proposal request is in flight.
   - The proposed fact reads as a clean, standalone sentence, not a
     verbatim copy of the guest-facing phrasing.
   - "Edit" swaps in an editable textarea pre-filled with the proposed
     text.
   - "Yes" saves, shows the confirmation state, and disables further
     clicks on that card.
   - "No" just removes the card, nothing saved.
7. Immediately after saving, start a **new** drill turn in the same
   section (same browser tab, same warm function instance most likely)
   and ask a related question — confirm Tico now references the new
   fact. This is the in-session propagation case; don't worry about
   confirming cross-instance propagation, that's expected to lag (see
   the design note above).
8. Confirm `restaurant-notes` in Firestore actually has the new doc.

## Prerequisite

None new beyond what Ticket 3 already set up (`FIREBASE_ADMIN_CREDENTIALS`
in `.env`, already confirmed working). Only a soft, non-blocking item:
before an actual production deploy, `FIREBASE_ADMIN_CREDENTIALS` needs to
be added to Netlify's site-level environment config too (not just local
`.env`), since File 2 makes the *build* depend on Firestore, not just
requests at runtime. Not needed for local implementation/testing.
