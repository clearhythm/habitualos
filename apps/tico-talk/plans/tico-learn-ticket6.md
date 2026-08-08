# Ticket 6: light prompt-layer PoC — Recommendations, Upselling, Complaints, Languages

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket reuses the streaming chat architecture Tickets 2-5 already built
(`chat-stream-core.ts`, the per-turn context-builder pattern, the
TICO:/GUEST: line-marker convention) for four new, much lighter-weight
competencies. See `docs/VISION.md`'s "Sequencing Pivot" section for the
full framing — this ticket is the light-PoC step in that sequence.

**Depends on Ticket 4** (restaurant entity, `restaurant-notes`,
`restaurant-menus`/`restaurants` collections, the sidebar's `My Training`
nav with these four currently showing "coming soon"). **Does not depend
on Ticket 5** — the two-pass coverage machinery is Menu-specific and
deliberately not reused here, see below.

**Why this is deliberately light**: per the vision doc's sequencing,
Menu gets real depth because it's the thing actually being validated
through Erik's own daily use. These four are a proof of concept for the
*content approach* (does the canonical/restaurant-specific split work,
does the assurance/empathy framing produce useful coaching feedback at
all), not production features yet. No coverage tracking, no tiers, no
gating, no Firestore progress writes for these four in this ticket —
just a working conversation per competency, restaurant-scoped, built on
infrastructure that already exists.

## Phase 0: Explore First

- `apps/tico-talk/netlify/edge-functions/chat-stream.ts` — the per-app
  config mapping `chatType` to `{initEndpoint, toolExecuteEndpoint}`.
  Currently only has `"learn"`. This ticket adds four more entries here
  — **not** a change to the shared `chat-stream-core.ts` itself, that
  file is generic across chat types already, nothing about it needs to
  know these four competencies exist.
- `apps/tico-talk/netlify/functions/learn-chat-init.cjs` (as Tickets 4/5
  leave it) — the shared-block/restaurant-block prompt-caching pattern
  this ticket reuses for each of the four new competencies, minus the
  third (coverage) block and minus the tool.
- `apps/tico-talk/src/assets/js/learn.js` — specifically
  `createStreamRenderer()`'s TICO:/GUEST: marker parsing (Ticket 3) and
  `renderAssistantTurn()`. This ticket needs the *two-marker* version
  (no ITEM:/FACT_TYPE:/RESULT:, that's Menu-specific), extracted into a
  shared module rather than copy-pasted four times — see File 6.
- `apps/tico-talk/netlify/functions/_services/db-restaurant-notes.cjs`
  and `db-restaurants.cjs` (Ticket 4) — reused as-is for restaurant-
  specific content (a restaurant's complaint policy, its clientele
  profile for Languages, its menu for Upselling/Recommendations
  pairings). No new Firestore collections needed in this ticket.
- `docs/DESIGN.md` Section 11 — the assurance (trustworthy knowledge,
  universal baseline) vs. empathy (guest-state-read, relational vs.
  transactional calibration) split, and why it's grounded in DINESERV
  rather than Wansink's compromised menu-psychology research.
  This is the one piece of real design work in this ticket: Recommendations
  and Upselling's system prompts need to evaluate on *both* axes
  separately, not blend them into one score.

## Overview

1. Four new chat types (`recommendations`, `upselling`, `complaints`,
   `languages`), each with its own `*-chat-init.cjs` — canonical
   technique (hardcoded, not DB-stored, this is the "how" that doesn't
   vary by restaurant) plus a restaurant-specific block (pulled from
   existing `restaurant-menus`/`restaurant-notes`/`restaurants` data,
   no new collections).
2. One shared, reusable simple-chat page template and client script
   (not four near-duplicate copies) — no picker/teach/drill three-phase
   structure like Menu has, no coverage bar, just "arrive, chat, done
   for now."
3. Sidebar's four "coming soon" entries become real links.
4. Recommendations/Upselling prompts explicitly coach on two separate
   axes (assurance/knowledge, empathy/calibration), not one blended
   score — the actual thing being validated by this PoC.

**Design note — canonical content is hardcoded, not DB-stored**: unlike
`restaurant-notes` (which exists specifically because facts need to be
correctable live, without a deploy), the canonical technique text for
each competency (how to structure an upsell, the general philosophy for
de-escalating a complaint) doesn't need that — it's not restaurant fact,
it's technique, and it changes by editing the prompt-builder file and
deploying, same as any other prompt copy in this app. Don't build a CMS
for something that doesn't need one yet.

**Design note — no coverage/tiers in this ticket, on purpose**: it would
be premature to build Ticket 5-style tracking for competencies whose
actual assessment rubric hasn't been validated yet (is assurance/empathy
even the right split? does it hold up in real use?). Ship the
conversation first, see what real use teaches, then decide what's worth
tracking and how — don't guess at tier mechanics before there's anything
to measure.

**Design note — one shared chat page, not four copies**: Recommendations,
Upselling, Complaints, and Languages are structurally identical from the
UI's perspective (arrive at a restaurant-scoped chat, talk to Tico,
that's it). Building four near-identical Nunjucks templates and four
near-identical client scripts would be pure duplication for zero benefit
— one template + one script, parameterized by chat type and copy.

## File 1: `netlify/functions/recommendations-chat-init.cjs` (NEW)

The other three (`upselling-chat-init.cjs`, `complaints-chat-init.cjs`,
`languages-chat-init.cjs`) follow this exact shape — same function
signature, same two-block structure, different canonical text and
different restaurant-specific data pulled in. Full code for this one;
the other three are described rather than repeated verbatim, since the
only real difference is prompt content.

```javascript
const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

// Canonical — doesn't vary by restaurant, edited by deploying, not by
// the flag-and-confirm flow (that's for restaurant facts, not technique).
const CANONICAL_TECHNIQUE = `Good recommendations start from what the guest actually said, not a script. Ask a genuine clarifying question if their preference isn't clear yet (spicy vs. mild, adventurous vs. familiar) rather than guessing. Once you recommend something, say briefly why it fits what they told you, don't just name a dish.

Evaluate the trainee's recommendation on two separate things, always both, never blended into one verdict:
1. ASSURANCE — was the recommendation actually accurate? Does the dish they picked genuinely match what's in the menu data (right flavor profile, right dietary fit, actually in stock)? This is a correctness question, same as Menu's rubric.
2. EMPATHY — did they read the guest correctly? A guest who's chatty and asking for the server's genuine opinion wants a different kind of answer than one who just wants a fast, confident suggestion so they can order. Did the trainee's tone and approach match what this particular guest actually seemed to want (relational vs. transactional), not just recite a fact?

Give feedback on both axes when relevant, don't average them into a single "good job" or "needs work."`;

function buildSharedPrompt(restaurant) {
  return `You are Tico, coaching a restaurant server-in-training on making menu recommendations at ${restaurant.name}.

${CANONICAL_TECHNIQUE}

Never use an em dash anywhere in your response, in either voice. Use a comma, period, or parentheses instead.`;
}

function buildRestaurantPrompt(restaurant, notes) {
  const menuSummary = restaurant.categories.map((c) => ({
    section: c.name,
    items: c.items.map((i) => ({ name: i.name, description: i.description, tags: i.tags || [] }))
  }));
  const restaurantNotes = notes.filter((n) => n.scope === 'restaurant');
  const notesBlock = restaurantNotes.length ? restaurantNotes.map((n) => `- ${n.text}`).join('\n') : '(none yet)';

  return `FORMAT, follow exactly: every line starts with "TICO:" or "GUEST:". GUEST: the customer's dialogue. TICO: your narration and your two-axis evaluation. Never skip the marker on a new line, never mix both on one line.

STOP after your GUEST: question, every turn. Never invent or assume the trainee's answer.

Play a guest at ${restaurant.name} who's open to a recommendation but hasn't committed to anything yet — vary how clear vs. vague they are about what they want, that's part of what's being practiced. Only recommend using what's actually in this menu:
${JSON.stringify(menuSummary, null, 2)}

RESTAURANT NOTES: ${notesBlock}

No markdown formatting, no code fences, no em dashes. Start now with your first line.`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId } = JSON.parse(event.body || '{}');
    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    }

    const restaurant = await getRestaurant(restaurantId);
    const notes = await getRestaurantNotes(restaurantId);

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildRestaurantPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } }
    ];

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemMessages, tools: [] }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
```

Note there's no third (coverage) block here, unlike `learn-chat-init.cjs`
post-Ticket-5 — nothing dynamic to report per turn, so this file really
is called fresh each turn but doesn't need the caching-split
justification Ticket 5 needed, both blocks are static per
restaurant+conversation.

## File 2: `netlify/functions/upselling-chat-init.cjs` (NEW)

Same shape as File 1. Canonical technique differs meaningfully from
Recommendations, not just a copy with find-replace — upselling is about
noticing a *moment* (a natural add-on opportunity), not answering a
direct ask:

```
Good upselling notices a real opening (they ordered an entree with no side, they're clearly celebrating something, they asked what's good and got an answer, natural moment to mention a pairing) rather than reciting an add-on at every guest regardless of context. It should never feel like a script.

Evaluate on the same two axes as Recommendations:
1. ASSURANCE — is what they're upselling actually accurate (real item, real price, real pairing)?
2. EMPATHY — was the moment actually right? Upselling a guest who's clearly price-conscious or in a hurry the same way as a guest who's settling in for a long, indulgent meal is a miss on this axis even if the suggestion itself was factually fine.
```

Restaurant-specific block: same menu-pull pattern as File 1, framed
around "does this table have a natural upsell opening right now,"
narrated the same way Menu's guest scenarios are.

## File 3: `netlify/functions/complaints-chat-init.cjs` (NEW)

Canonical technique — de-escalation philosophy, not a script:

```
Handling a complaint well means acknowledging what the guest is feeling before problem-solving, never defensive, never over-apologizing to the point of sounding scripted. What you're actually allowed to offer (a comp, a remake, a discount) depends entirely on this restaurant's own policy below, don't assume a universal answer.
```

Restaurant-specific block pulls from `restaurant-notes` filtered to
whatever's relevant to complaint handling (comp policy, when to involve
a manager) — this is the clearest case of a restaurant's *business
logic*, not just its menu, mattering (see the vision doc's note that
complaint handling may genuinely differ by restaurant tier). If
Margaritaville/Pete's don't have this policy captured as restaurant
notes yet, that's real content Erik needs to add via the existing
flag-and-confirm flow (Ticket 4) once this ticket's chat exists to
surface the gap, not something to fabricate here.

## File 4: `netlify/functions/languages-chat-init.cjs` (NEW)

The one that pulls from `restaurant.clientele` (Ticket 4's addition to
the `restaurants` collection) rather than menu/notes:

```javascript
function buildSharedPrompt(restaurant) {
  const languages = restaurant.clientele?.languages || [];
  const languageList = languages.length
    ? languages.map((l) => `${l.name} (${l.ratio})`).join(', ')
    : '(no clientele profile set for this restaurant yet)';

  return `You are Tico, helping a server at ${restaurant.name} practice useful service phrases. This restaurant's clientele: ${languageList}. Drill phrases relevant to those languages specifically, not a generic language module — a restaurant with a different clientele mix would practice differently.

...`;
}
```

If `restaurant.clientele.languages` is empty (Pete's, until Erik
supplies a real profile per Ticket 4's prerequisite), this chat type
should say so plainly rather than guessing at a plausible-sounding
default — same data principle as everywhere else in this app.

## File 5: `apps/tico-talk/netlify/edge-functions/chat-stream.ts` (MODIFY)

Add all four to the existing config object — the shared
`chat-stream-core.ts` needs no changes, it already dispatches on
`chatType` generically:

```typescript
export default createChatStreamHandler({
  "learn": {
    initEndpoint: "/api/learn-chat-init",
    toolExecuteEndpoint: "/api/learn-tool-execute",
    signalPatterns: [],
  },
  "recommendations": { initEndpoint: "/api/recommendations-chat-init", toolExecuteEndpoint: null, signalPatterns: [] },
  "upselling": { initEndpoint: "/api/upselling-chat-init", toolExecuteEndpoint: null, signalPatterns: [] },
  "complaints": { initEndpoint: "/api/complaints-chat-init", toolExecuteEndpoint: null, signalPatterns: [] },
  "languages": { initEndpoint: "/api/languages-chat-init", toolExecuteEndpoint: null, signalPatterns: [] },
});
```

`toolExecuteEndpoint: null` — confirm `chat-stream-core.ts` handles a
null endpoint gracefully for chat types with no tools (it should, tool
handling is already conditional on `config.toolExecuteEndpoint` truthy),
don't assume.

## File 6: `src/assets/js/simple-chat.js` (NEW) — shared client module

The two-marker (TICO:/GUEST: only) version of Ticket 3's streaming
renderer, extracted so it's not copy-pasted four times *and* so
`learn.js` could eventually import it too instead of maintaining a
parallel copy (not required for this ticket, just noted as available).

```javascript
// Same holdback-based marker parser as learn.js, minus ITEM:/FACT_TYPE:/RESULT: —
// these four competencies have no hidden tracking markers, every line
// is either TICO: or GUEST: and gets shown.
const SEGMENT_MARKER_RE = /(?:^|\n)[ \t]*(TICO|GUEST):[ \t]?/;
const SEGMENT_MARKER_HOLDBACK = 6;

export function createSimpleChat({ transcriptEl, chatType, restaurantId, userId }) {
  let chatHistory = [];

  function createSegmentElement(speaker) {
    const el = document.createElement('p');
    el.className = speaker === 'tico' ? 'transcript-line transcript-line--tico' : 'transcript-line transcript-line--guest';
    transcriptEl.appendChild(el);
    return el;
  }

  function createStreamRenderer() {
    // identical shape to learn.js's version, TICO/GUEST branch only —
    // see Ticket 3/5 for the full holdback logic, not repeated here.
  }

  async function sendTurn(message) {
    // same fetch('/api/chat-stream', {chatType, restaurantId, userId, message, chatHistory}) shape as learn.js's sendTurn(),
    // minus factCoverage/section (these chat types don't have either).
  }

  return { sendTurn, /* ... */ };
}
```

Full parser/renderer implementation is a direct lift from `learn.js`'s
`createStreamRenderer()`/`appendLine` (Ticket 3), stripped of the
ITEM:/FACT_TYPE:/RESULT: handling — reference that file directly while
implementing rather than re-deriving it.

## File 7: `src/simple-chat.njk` (NEW) — shared template, four permalinks

One Nunjucks template, rendered four times via 11ty pagination (or four
thin wrapper files each setting `chatType`/title/copy and including the
shared markup) — implementer's call on which 11ty mechanism reads
cleaner, both produce the same four real URLs
(`/recommendations/`, `/upselling/`, `/complaints/`, `/languages/`).
Reuses `.learn-drill`'s transcript/input-shell structure minus the
picker/teach phases and the progress bar (no coverage here) — arrives
directly in a chat, no phase-switching.

## File 8: `src/_includes/nav.njk` (MODIFY)

The four `coming-soon` spans become real links:

```html
<!-- Before -->
<span class="sidemenu-account__soon">Recommendations <em>soon</em></span>

<!-- After -->
<a href="/recommendations/">Recommendations</a>
```

Repeat for Upselling, Complaints, Languages.

## Verification

1. `node --check` on all four new `*-chat-init.cjs` files.
2. `sass` compile / full `pnpm build`.
3. Manual review of the `chat-stream.ts` diff.
4. Via `netlify dev`: visit each of the four new pages, confirm a real
   conversation starts (not a 404, not an error), Tico stays in scope
   for that competency, references real restaurant data (not invented
   facts), and never states something not in the menu/notes/clientele
   data it was given.
5. For Recommendations and Upselling specifically: deliberately give one
   factually-wrong-but-well-calibrated answer and one factually-right-
   but-poorly-calibrated answer (e.g., a confident guess at an inaccurate
   pairing vs. a correct pairing delivered in a flat, script-like way to
   a guest who clearly wanted a personal recommendation). Confirm Tico's
   feedback actually distinguishes the two axes rather than giving one
   blended verdict either time.
6. Confirm switching restaurants (Ticket 4's switcher) changes what each
   of these four chats references — Languages especially, since it reads
   `clientele` directly.

## Prerequisite

None new. Reuses Ticket 4's Firestore setup and restaurant data
entirely. If Pete's `clientele` profile or complaint-policy notes aren't
populated yet, Languages/Complaints will correctly say so rather than
inventing plausible defaults — not a blocker, just expected until Erik
adds that real data via the flag-and-confirm flow or a future intake
step.
