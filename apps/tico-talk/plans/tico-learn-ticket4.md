# Ticket 4: multi-restaurant infrastructure, DB-backed menu data, restaurant notes, live corrections

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). Backend:
Netlify Functions (Node.js CommonJS). Database: Google Firestore via
`@habitualos/db-core`, already wired up in Ticket 3. Frontend: 11ty +
Nunjucks (static site generation at build time) + vanilla JS ES modules
(runtime, in the browser). AI: `@anthropic-ai/sdk`.

**Depends on Tickets 1-3** — the drill UI, streaming backend, and
Firestore persistence layer all exist. **Supersedes the original,
single-restaurant version of this ticket** — that version was written
and never implemented, so this rewrite replaces it outright rather than
building single-restaurant first and redoing it. See `docs/VISION.md`
(in particular "The Competency Model" and "Two Competency Shapes") for
the full context this rewrite comes from.

**Why this ticket exists, and why it grew**: started from a real gap —
Tico correctly refuses to state anything not in the menu data, but the
menu file is necessarily incomplete (it's a menu, not an operations
manual), so it sometimes disputes something a real staff member already
knows. That's still true and still the core of this ticket (restaurant
notes + the flag-and-confirm correction flow). But in the time since
this was first planned, Erik moved to working at Pete's more or less
full-time on top of Margaritaville, and the app needs to actually work
across both: pick a restaurant, drill its menu, track progress
separately per restaurant. That's not a side feature bolted onto the
knowledge-correction work, it's the same underlying move (menu data
stops being a single hardcoded file and becomes real, queryable data),
just parameterized by restaurant instead of assumed singular.

## Phase 0: Explore First

- `apps/tico-talk/netlify/functions/learn-chat-init.cjs` — current
  `require()` of the static JSON, single-restaurant. Read fully before
  touching; this ticket changes where the menu data comes from, adds a
  restaurant dimension to every lookup, and adds a second (notes) data
  source.
- `apps/tico-talk/src/_data/menus/margaritaville.json` — shape being
  migrated: `{venueId, name, categories: [{name, items: [{id, name,
  description, price, tags, allergens, notes}]}]}`. 14 categories today.
  This becomes the shape of *one restaurant's* menu doc, not the only
  menu doc.
- **Eleventy's data cascade**: this file isn't only `require()`'d by
  `learn-chat-init.cjs` — Eleventy loads everything under `src/_data/`
  as global template data (`menus` in templates), which is how
  `menu.njk`, `drinks.njk`, `menu-review.njk`, and `learn.njk`'s picker
  all render today. Converting this to an async multi-restaurant data
  file (File 2) means the static pages and the runtime prompt end up
  reading the same source, not two independently-drifting copies — same
  principle as the original ticket, now covering multiple restaurants
  instead of one.
- `apps/tico-talk/src/_includes/nav.njk` — the current sidebar. Static
  venue label (`{{ menus[0].name }}`), then a flat `My Sessions` group
  with `Learn`/`Practice`/`Progression`. This ticket replaces the label
  with a real switcher and restructures the group into `My Training`
  with six competency links (per `docs/VISION.md`'s "The Competency
  Model") — only Menu is a real, working link right now, the rest are
  coming-soon.
- `packages/db-core/db-core.cjs` — reused as-is (`create`, `get`,
  `query`, `uniqueId`).
- `apps/tico-talk/.env`'s `FIREBASE_ADMIN_CREDENTIALS` — already set up,
  reused. Still needs to be added to Netlify's site-level env config for
  production builds (not just local `.env`), since the Eleventy build
  itself now depends on Firestore being reachable at build time, not
  just at request time — flagged in the original ticket, still true.
- `apps/dreamscape/src/reflect.njk:36-49` and
  `apps/dreamscape/src/styles/_components.scss:1957-2002, 2071-2103` —
  the quiet `.chat-toolbar-btn` pattern and the generic `[data-tooltip]`
  utility, reused for the flag button exactly as originally planned,
  unchanged by the multi-restaurant rework.
- `apps/tico-talk/src/learn.njk` and `src/assets/js/learn.js` — the
  section picker's existing `data-section` show/hide pattern
  (`.learn-teach__section`). This ticket adds a parallel `data-restaurant`
  dimension using the *same* filtering approach, not a new mechanism.

## Overview

1. **Restaurant becomes a first-class Firestore entity.** A
   `restaurants` collection, each doc holding the venue's identity plus
   config beyond the menu (a clientele/language profile, used by the
   later Languages competency — see the vision doc). Seeded with both
   Margaritaville (migrated from the existing JSON) and Pete's (new,
   needs real data from Erik, see Prerequisite).
2. **Menu data and restaurant notes both become restaurant-scoped.**
   Same DB-migration work the original ticket already planned
   (Firestore as the single source of truth, read at build time by
   Eleventy and cached at runtime by the Netlify function), now keyed by
   restaurant instead of assumed singular.
3. **Sidebar restructuring**: a real restaurant switcher replacing the
   static venue label, and `My Training` replacing the flat
   Learn/Practice/Progression list with the six competencies from
   `docs/VISION.md`'s "The Competency Model" (Menu functional, Off-Menu/
   Recommendations/Upselling/Complaints/Languages shown as coming soon).
4. **Restaurant notes + the flag-and-confirm correction flow**, as
   originally planned, now scoped to the current restaurant.

**Design note — how the switcher actually works, given this is a static
site**: Eleventy generates HTML at build time, so "switch restaurant"
can't mean "fetch different content from the server" without adding a
runtime API dependency just to view reference pages. Instead: *all*
restaurants' content gets baked into the page at build time (same
pattern the section picker already uses — every section's teach content
already exists in the DOM, hidden until picked), each restaurant's block
tagged `data-restaurant="{id}"`. A small client-side utility shows only
the currently-selected restaurant's blocks, same mechanism as the
existing `data-section` filtering, just one more dimension. The switcher
itself just updates `localStorage['tico-current-restaurant']` and
reloads. No new runtime data-fetching pattern, reuses what's already
proven for section-switching.

**Design note — why a build-time data file for the menu, not just a
runtime fetch** (unchanged from the original ticket, still the reason):
stopping at "make `learn-chat-init.cjs` read from Firestore" and leaving
the static pages reading committed JSON creates two sources of truth
that will drift. The Eleventy data file itself reads from Firestore at
build time, at the cost of the production build depending on Firestore
being reachable at deploy time — a real tradeoff, noted rather than
decided silently.

**Design note — restaurant notes stay two-tier (restaurant/section),
not per-restaurant-chain-wide**: a note like "hot sauce is available on
request" is true for *this* restaurant, not automatically true for every
restaurant in the system. `restaurant-notes` docs carry a `restaurantId`
plus the existing `scope: 'restaurant' | 'section'` distinction *within*
that restaurant. No cross-restaurant note sharing in this ticket — this
is deliberate, not an oversight (a note is a fact about *this*
restaurant specifically, not something that generalizes just because
another restaurant happens to exist in the system).

**Design note — extract, don't ask for retyping** (unchanged): the flag
button sends the last exchange to an extraction call that proposes a
clean, standalone fact, the trainee confirms/edits/rejects rather than
retyping it from scratch.

## File 1: One-time Firestore seed (run once, not part of the app)

Not committed — a throwaway script, run twice (once per restaurant).

```javascript
require('dotenv').config();
const dbCore = require('@habitualos/db-core');

async function seedRestaurant({ id, name, menuData, clientele }) {
  await dbCore.create({ collection: 'restaurants', id, data: { name, clientele } });
  await dbCore.create({ collection: 'restaurant-menus', id, data: menuData });
  console.log('seeded restaurant:', id);
}

seedRestaurant({
  id: 'margaritaville',
  name: 'Margaritaville Capitola',
  menuData: require('./src/_data/menus/margaritaville.json'),
  clientele: { languages: [{ name: 'Spanish', ratio: 'majority' }] } // real ratios TBD, see Prerequisite
}).catch((e) => { console.error(e); process.exit(1); });
```

Run for `margaritaville` first (real data already exists), then again
for `petes` once Erik has supplied real menu + clientele data (see
Prerequisite — **do not fabricate Pete's menu content**, per
`docs/VISION.md`'s Data Principle: menu data is scanned/confirmed
real-world fact, never AI-invented, even as a placeholder).
Confirm via Firestore console or `dbCore.get` that both
`restaurants/{id}` and `restaurant-menus/{id}` exist for each before
moving on.

## File 2: `src/_data/restaurants.js` (REPLACES `menus/margaritaville.json`)

Now fetches *all* restaurants, not one. Eleventy JS data files support
async functions; this becomes the single source both static pages and
the runtime prompt ultimately read from.

```javascript
const dbCore = require('@habitualos/db-core');

module.exports = async function () {
  const restaurants = await dbCore.query({ collection: 'restaurants' });
  if (!restaurants.length) throw new Error('No restaurants found in Firestore — run the seed script (Ticket 4, File 1) first.');

  const withMenus = await Promise.all(restaurants.map(async (r) => {
    const menu = await dbCore.get({ collection: 'restaurant-menus', id: r.id });
    return { ...r, ...menu }; // { id, name, clientele, venueId, categories }
  }));

  return withMenus;
};
```

The global template variable is still called `menus` today — decide
while implementing whether to rename it to `restaurants` throughout
every template that references it (`menu.njk`, `drinks.njk`,
`menu-review.njk`, `learn.njk`) for clarity, or keep the `menus` name to
minimize the diff. Whichever's picked, every one of those templates now
needs to iterate *all* restaurants and tag output with
`data-restaurant="{{ restaurant.id }}"` (see File 6) instead of assuming
one.

Delete `src/_data/menus/margaritaville.json` once this is confirmed
working (`git rm`) — nothing reads it directly anymore.

## File 3: `netlify/functions/_services/db-restaurants.cjs` (NEW)

Runtime counterpart to File 2 — cached per warm instance, same "load
once, reuse across requests" behavior `require()` gave for free,
replacing the original ticket's `db-menu.cjs` (now needs to hold more
than one restaurant's data, and the restaurant list itself, not just one
menu doc).

```javascript
//
// netlify/functions/_services/db-restaurants.cjs
// ------------------------------------------------------
// Cached accessor for restaurant + menu data. Same Firestore docs
// Eleventy reads at build time (src/_data/restaurants.js) — this is the
// runtime (Netlify Function) side, cached per warm instance so a chat
// turn doesn't cost a Firestore read on top of the Anthropic call.
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

let cache = null; // Map<restaurantId, {id, name, clientele, ...menuData}> | null

async function loadAll() {
  if (cache) return cache;
  const restaurants = await dbCore.query({ collection: 'restaurants' });
  const entries = await Promise.all(restaurants.map(async (r) => {
    const menu = await dbCore.get({ collection: 'restaurant-menus', id: r.id });
    return [r.id, { ...r, ...menu }];
  }));
  cache = new Map(entries);
  return cache;
}

exports.getRestaurant = async (restaurantId) => {
  const all = await loadAll();
  const restaurant = all.get(restaurantId);
  if (!restaurant) throw new Error(`Unknown restaurant: ${restaurantId}`);
  return restaurant;
};
```

No cache invalidation here deliberately, same reasoning as the original
ticket — restaurant/menu data changing is rare, redeploy or wait for
natural instance recycling if it does.

## File 4: `netlify/functions/_services/db-restaurant-notes.cjs` (NEW)

Same shape as the original ticket's version, with `restaurantId` added
throughout — notes from one restaurant must never leak into another's
prompt.

```javascript
//
// netlify/functions/_services/db-restaurant-notes.cjs
// ------------------------------------------------------
// Freeform facts supplementing menu data in a drill's system prompt,
// scoped to one restaurant. Within that restaurant, two sub-scopes:
//   - 'restaurant': true regardless of section within this restaurant.
//   - 'section': true only within one section of this restaurant.
// Added live via the flag-and-confirm correction flow (Files 7-8).
//
// Schema:
//   restaurant-notes/{noteId}
//   {
//     restaurantId: string,
//     text: string,
//     scope: 'restaurant' | 'section',
//     section: string | null,
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'restaurant-notes';

let cache = null; // Map<restaurantId, Array<note>> | null

exports.getRestaurantNotes = async (restaurantId) => {
  if (!cache) cache = new Map();
  if (cache.has(restaurantId)) return cache.get(restaurantId);
  const notes = await dbCore.query({ collection: COLLECTION, where: `restaurantId::eq::${restaurantId}` });
  cache.set(restaurantId, notes);
  return notes;
};

/**
 * @param {string} restaurantId
 * @param {string} text
 * @param {{scope: 'restaurant'|'section', section?: string}} classification
 */
exports.addRestaurantNote = async (restaurantId, text, { scope, section = null }) => {
  const data = { restaurantId, text, scope, section: scope === 'section' ? section : null };
  const { id } = await dbCore.create({ collection: COLLECTION, data });
  const note = { id, ...data };
  if (!cache) cache = new Map();
  const existing = cache.get(restaurantId) || [];
  cache.set(restaurantId, [...existing, note]);
  return note;
};
```

Note the `where: "restaurantId::eq::${restaurantId}"` string-based query
format — matches `db-core.cjs`'s established syntax (`field::eq::value`),
confirm this still holds while implementing rather than assuming.

## File 5: `netlify/functions/learn-chat-init.cjs` (MODIFY)

Threads `restaurantId` through everything. Same two-block cached-prompt
shape as the original ticket (shared block + section block), both now
scoped to a restaurant.

```javascript
const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

function findSection(restaurant, sectionName) {
  return restaurant.categories.find((c) => c.name === sectionName) || null;
}

function buildSharedPrompt(restaurant, notes) {
  const restaurantNotes = notes.filter((n) => n.scope === 'restaurant');
  const notesBlock = restaurantNotes.length
    ? restaurantNotes.map((n) => `- ${n.text}`).join('\n')
    : '(none yet)';

  return `You are Tico, a warm, experienced coworker helping a restaurant server-in-training drill their knowledge of the menu at ${restaurant.name}.

The trainee is a server working the floor, not a host at the entrance. Every customer in this drill is already seated at a table, mid-visit. That means the trainee can and should take orders, make recommendations, and answer questions the way a server actually would. Never frame anything as out of scope for them because "that's the host's job" or "wait until they're seated," they're already seated.

RESTAURANT NOTES for ${restaurant.name} (apply across every section, equally authoritative to the section's menu data below — these are staff-confirmed facts, not guesses):
${notesBlock}

Never use an em dash anywhere in your response, in either voice. Use a comma, period, or parentheses instead.`;
}

function buildSectionPrompt(restaurant, section, notes) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  const sectionNotes = notes.filter((n) => n.scope === 'section' && n.section === section.name);
  const sectionNotesBlock = sectionNotes.length
    ? `\nADDITIONAL NOTES FOR THIS SECTION:\n${sectionNotes.map((n) => `- ${n.text}`).join('\n')}\n`
    : '';

  return `Drilling section: "${section.name}" at ${restaurant.name}.

Each round works like this: you ask ONE question as if you were an ordinary seated customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question, or just placing an order). Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with either "TICO:" or "GUEST:" (all caps, immediately followed by a colon and a space), marking who's speaking that line. Use GUEST: for the customer's own question or line of dialogue. Use TICO: for everything that's you: narrating the scene, evaluating the trainee's answer, or any other aside. Never put GUEST and TICO content on the same line, and never skip the marker on a new line.

STOP after your GUEST: question, every turn. Never invent, assume, or simulate what the trainee would say, only evaluate an answer they actually gave earlier in this conversation.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly, across however many customer interactions it takes, that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer, wait for real, repeated, demonstrated recall.

SECTION DATA (${section.name} at ${restaurant.name} only):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
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
    const { restaurantId, section: sectionName } = JSON.parse(event.body || '{}');
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

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes), cache_control: { type: 'ephemeral' } }
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

**`restaurantId` needs to reach this endpoint** the same way `section`
already does — extend `chat-stream-core.ts`'s `initBody` construction
(the shared file, already customized for `section` in Ticket 2) to also
pass through `restaurantId`, same pattern, then re-sync the local copy
in `apps/tico-talk/netlify/edge-functions/_lib/`.

**This file gets revisited again in Ticket 5**, exactly as the original
ticket noted (third uncached coverage block, drops the tool, notes
filtering) — restaurant-scoping doesn't change that plan, just adds the
`restaurantId` parameter throughout it too.

## File 6: `netlify/functions/learn-propose-correction.cjs` and `learn-save-correction.cjs` (NEW)

Same shape as the original ticket, `restaurantId` threaded through both.

```javascript
// learn-propose-correction.cjs — same extraction logic as before, plus:
const { restaurantId, lastUserMessage, lastAssistantMessage, currentSection } = JSON.parse(event.body || '{}');
if (!restaurantId || !lastUserMessage || !lastAssistantMessage || !currentSection) {
  return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId, lastUserMessage, lastAssistantMessage, and currentSection are required' }) };
}
// ...extraction prompt unchanged, restaurant name could be included for
// slightly better classification context but isn't required...
```

```javascript
// learn-save-correction.cjs
const { addRestaurantNote } = require('./_services/db-restaurant-notes.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, text, scope, section } = JSON.parse(event.body || '{}');
    if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    if (!text || !text.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'text is required' }) };
    if (!['restaurant', 'section'].includes(scope)) return { statusCode: 400, body: JSON.stringify({ error: 'scope must be "restaurant" or "section"' }) };
    if (scope === 'section' && !section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required when scope is "section"' }) };

    const note = await addRestaurantNote(restaurantId, text.trim(), { scope, section });
    log('debug', '[learn-save-correction] saved note', note.id, 'restaurant:', restaurantId, 'scope:', scope);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, note }) };
  } catch (error) {
    log('error', '[learn-save-correction] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

## File 7: `src/_includes/nav.njk` (MODIFY) — restaurant switcher + My Training

```html
<div class="sidemenu-left">
  <button class="sidemenu-venue" id="restaurant-switcher-trigger" aria-label="Switch restaurant">
    <span id="current-restaurant-name">{{ restaurants[0].name }}</span>
    <span class="sidemenu-venue__chevron" aria-hidden="true">▾</span>
  </button>
  <ul>
    <li><a href="/menu/">Menu</a></li>
    <li><a href="/drinks/">Drinks</a></li>
  </ul>
  <div class="sidemenu-account">
    <p class="sidemenu-account__label">My Training</p>
    <a href="/learn/">Menu</a>
    <span class="sidemenu-account__soon">Off-Menu <em>soon</em></span>
    <span class="sidemenu-account__soon">Recommendations <em>soon</em></span>
    <span class="sidemenu-account__soon">Upselling <em>soon</em></span>
    <span class="sidemenu-account__soon">Complaints <em>soon</em></span>
    <span class="sidemenu-account__soon">Languages <em>soon</em></span>
    <a href="/stats/">Progression</a>
  </div>
  ...
</div>

<div class="restaurant-switcher" id="restaurant-switcher" hidden>
  {% for restaurant in restaurants %}
  <button class="restaurant-switcher__option" data-restaurant-id="{{ restaurant.id }}">{{ restaurant.name }}</button>
  {% endfor %}
</div>
```

A small popover/dropdown, not a full modal — exact presentation
(anchored dropdown vs. a simple inline expand) is a judgment call once
it's in front of you, but keep it lightweight, this is a two-restaurant
list today, not something needing a heavy component.

## File 8: `src/assets/js/restaurant.js` (NEW) — shared restaurant-selection utility

Used by `nav.njk`'s switcher and by every page that renders
restaurant-tagged content (`learn.js`, and eventually `menu.njk`/
`drinks.njk` if those get client-side filtering too — see the open
question below).

```javascript
const STORAGE_KEY = 'tico-current-restaurant';

export function getCurrentRestaurantId(fallbackId) {
  try {
    return localStorage.getItem(STORAGE_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function setCurrentRestaurantId(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export function applyRestaurantFilter(containerSelector, restaurantId) {
  document.querySelectorAll(`${containerSelector}[data-restaurant]`).forEach((el) => {
    el.hidden = el.dataset.restaurant !== restaurantId;
  });
}
```

Wire the switcher trigger/popover in `nav.njk`'s companion script
(wherever `sidemenu-toggle` already lives) to call `setCurrentRestaurantId`
and reload on selection — simplest correct behavior, avoids needing to
re-filter every already-rendered page's content live.

## File 9: `src/assets/js/learn.js` (MODIFY) — restaurant-aware picker + flag button

The section picker needs a `data-restaurant` filter layered on top of
its existing `data-section` filter — a trainee should only see *this*
restaurant's sections in the picker, and drilling needs to send
`restaurantId` with every turn.

```javascript
import { getCurrentRestaurantId } from './restaurant.js';

const currentRestaurantId = getCurrentRestaurantId(/* first restaurant's id, passed from a data attribute on <body> or similar */);

// Picker filtering — layer on top of the existing pill click handlers:
document.querySelectorAll('.learn-picker .competency-pill').forEach((pill) => {
  pill.hidden = pill.dataset.restaurant !== currentRestaurantId;
});
```

`sendTurn()`'s request body gains `restaurantId: currentRestaurantId`
alongside the existing `section`. The flag-and-confirm correction flow
(`showCorrectionCard`/the save call) gains the same field. Both are
mechanical additions to request bodies already built in the original
version of this ticket — the actual UX (propose → confirm/edit/reject)
is unchanged.

`learn.njk`'s picker pills need `data-restaurant="{{ restaurant.id }}"`
added alongside their existing `data-section` attribute, once the
picker's Nunjucks loop iterates all restaurants (File 2's `restaurants`
data) instead of one.

## Open question, not resolved in this ticket

Do `/menu/` and `/drinks/` (the reference pages) get the same
client-side `data-restaurant` filtering as the Learn picker, or does
switching restaurants there just mean "reload and everything's already
filtered by the same mechanism"? Functionally these should behave the
same way as the picker (same `applyRestaurantFilter` utility, File 8),
but confirm while implementing whether `menu-categories.njk`'s macro
needs a `restaurantId` param threaded through or whether wrapping its
output in a restaurant-tagged container from the calling template is
enough — likely the latter, don't restructure the shared macro if the
wrapper approach works.

## Verification

1. `node --check` on all new/modified `.cjs` files and `learn.js`.
2. `sass` compile / full `pnpm build`.
3. Run the File 1 seed script for both restaurants, confirm
   `restaurants/margaritaville`, `restaurant-menus/margaritaville`,
   `restaurants/petes`, `restaurant-menus/petes` all exist in Firestore.
4. `pnpm build` — confirm `/menu/`, `/drinks/`, `/menu-review/`, and
   `/learn/`'s picker all still render, now reading from Firestore via
   `restaurants.js` instead of the deleted single-menu JSON.
5. Via `netlify dev`: confirm the sidebar shows the switcher, switching
   restaurants reloads and shows the correct one's Menu/Drinks/picker
   content, and picking a different restaurant's section drills that
   restaurant's actual menu data (not the other one's).
6. Confirm `My Training` shows Menu as a working link and the other five
   as visibly disabled/coming-soon, not broken links.
7. Repeat the original ticket's correction-flow verification (flag a
   true-but-disputed fact, confirm/edit/reject, confirm it lands in
   `restaurant-notes` with the correct `restaurantId`) — for *both*
   restaurants, confirming a note added while drilling Margaritaville
   never shows up while drilling Pete's.

## Prerequisite (interactive — needs Erik)

**Real Pete's menu data and clientele profile.** Per the data principle
this app has followed since the very first menu extraction: never
fabricate menu content, even as a placeholder. Needed before File 1's
Pete's seed can run:
- Pete's full menu (items, descriptions, prices, tags/allergens — same
  shape as Margaritaville's existing JSON).
- A rough clientele/language profile (e.g. "roughly even Chinese/Spanish
  split" is enough precision for now, exact ratios aren't needed yet).

Also, same as the original ticket: `FIREBASE_ADMIN_CREDENTIALS` needs to
land in Netlify's site-level env config before a real production deploy,
not just local `.env` — not blocking local implementation.
