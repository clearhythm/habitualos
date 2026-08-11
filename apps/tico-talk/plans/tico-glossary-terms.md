# Glossary terms: tap-to-define exotic menu terms

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket adds a small, standalone feature to the `/menu/` Review panel: a
tappable term (e.g. "Mignonette" under Oysters on the 1/2 Shell, "$28")
that pops over a canonical definition, instead of leaving the trainee to
wonder what it is. Not built yet — this is a design capture from a live
conversation with Erik, to pick up once Ticket 5's review/testing is done.

**Real motivating example** (Pete's Fish House menu): "Oysters on the 1/2
Shell — $28 — Mignonette, lemon." A trainee reading this has no way to
know what mignonette is without asking someone or looking it up
elsewhere. The feature is a tap target on that word, right there.

**Not in scope for this ticket**: a second, larger idea came up alongside
this one — compositing a drink's likely glass + its ingredient bottles
into a tidy visual group, so a trainee can *see* what a drink is made of.
That's a real idea but a much bigger asset-pipeline problem (sourcing/
generating images) — explicitly parked, not part of this ticket. This
ticket is text-only by design, specifically so it doesn't need that.

## The rubric (calibrated live against real menu data, don't re-derive)

Population is LLM-driven: a batch scan across menu items proposes
candidate terms + definitions, which Erik reviews/edits before anything
goes live — mirrors the existing flag-and-confirm correction flow
(`learn-propose-correction.cjs`/`learn-save-correction.cjs`), same "never
fabricate, always confirm" principle already established in this app.

A term qualifies if it clears ALL of:

1. **Hidden composition or non-obvious specificity** — one of:
   - Composed of distinct, unlisted sub-ingredients (aioli = oil+garlic+
     egg+lemon; mignonette = vinegar+shallot+pepper; pico de gallo =
     tomato+onion+cilantro+chili+lime), OR
   - A named variety/technique whose nature isn't self-evident from the
     word alone, even from one base ingredient (crème fraîche = cultured
     cream; consommé = clarified stock; queso Oaxaca/queso fresco =
     specific cheese styles; "Spanish rice" = tomato-based seasoned rice
     — a plain-English name that still hides real composition).
2. **Stable, definable family** — real regional/kitchen variance is fine
   (consommé differs restaurant to restaurant but stays recognizable),
   but a vague descriptive phrase with no fixed referent does NOT qualify
   ("creamy lime dressing" — could be mayo-, yogurt-, or sour-cream-based,
   no canonical answer exists). This is the gate that matters most: it's
   a factual-integrity issue (don't invent a plausible-sounding
   composition for something with no real fixed answer), not just a UX
   one.

**Explicitly excluded**: single raw/basic ingredients (chives, lemon,
cilantro, garlic — the ingredient IS the thing, nothing to unpack) and
generic descriptive phrases naming qualities rather than a specific dish
("creamy lime dressing" fails the stable-family gate even though
grammatically similar to a legitimate case like "Spanish rice").

**Explicitly does NOT matter**: how mainstream the *word* is. "Aioli" and
"pico de gallo" are common on US menus today but still qualify via hidden
composition — familiarity of the term doesn't override that. Full worked
examples (10 real terms, right/wrong-then-corrected reasoning) are saved
in memory (`project_tico_glossary_rubric.md`) — reference that directly
when writing the actual scan prompt rather than re-deriving the rubric.

## Decided

- **Two-tier storage: a `glossary` Firestore collection (scan-time only,
  never fetched by a trainee's browser) + a resolved `glossaryTerms` field
  written onto each restaurant's own existing document via a "hydration
  pass."** Landed here after two earlier passes (a pure Firestore-
  collection design, then a static-file-in-the-codebase design) — both
  captured below since the reasoning from each still partly applies.
  - **The hydration pass**: an LLM-driven, admin-triggered step (run
    once initially, then re-run manually as a "refresh command" — see
    below) that reads the canonical `glossary` collection and writes the
    resolved, restaurant-relevant subset into that restaurant's own
    `glossaryTerms` field. This is the actual mechanism behind every
    write in this design — the scan doesn't invent definitions fresh
    each time, it hydrates each restaurant's document from the shared
    canonical knowledge, generating new canonical entries only when a
    term genuinely isn't in `glossary` yet.
  - **`glossary` (Firestore collection)**: the canonical, shared source
    of definitions, plus the scan process's own memory of "have I already
    defined this term" (so scanning a second restaurant reuses an
    existing definition instead of regenerating slightly-different
    wording for the same sense). Only ever read/written by the batch
    scan process — never fetched directly by a trainee's browser. Because
    of that, the earlier per-term Firestore read-cost concern (one read
    per term, every cold-cache page load) simply doesn't apply here — it
    was only ever a concern for a hot, user-facing read path, and this
    collection isn't one. Original shape holds: generated `g-{unique}`
    doc ids, `_glossaryId` (mirrors the doc id), `_name` (display-cased
    term, matching `restaurant-menus`' existing `_name` convention),
    definition text, `_cuisineType` where genuinely needed for the
    canonical entry itself.
  - **Resolved `glossaryTerms` field on the restaurant's own document**
    (`restaurants/{id}` or `restaurant-menus/{id}` — whichever
    `db-restaurants.cjs` already builds from). Shape: a simple array of
    `{glossaryId, term}` pairs —
    ```
    glossaryTerms: [
      { glossaryId: "g-xxx", term: "salsa verde" },
      { glossaryId: "g-yyy", term: "mignonette" }
    ]
    ```
    `glossaryId` references the canonical `glossary` doc (keeps the
    actual definition text single-source-of-truth there, not duplicated
    per restaurant); `term` is just the matching string the render side
    searches for in description text — no display-cased duplicate needed
    here, that's `_name` on the `glossary` doc itself, fetched on tap.
    The hydration pass writes just the terms relevant to *that*
    restaurant's current menu here,
    resolved from (or referencing) the canonical collection. This is what
    actually gets read at runtime — and since the restaurant's own
    document is *already* fetched on every `/menu/` load
    (`getRestaurantMenu`/`restaurant-menu-get.cjs`), this adds **zero**
    additional network request, not even a cheap cached one. Beats both
    earlier designs on cost, not just on simplicity.
  - **Disambiguation is now free**: because `glossaryTerms` is scoped to
    one restaurant's own document, there's no multi-sense ambiguity to
    resolve at read time at all — "salsa verde" in Margaritaville's field
    can only mean what Margaritaville's own menu means by it. The
    `_cuisineType`-based runtime matching this ticket worked through
    earlier is no longer needed; disambiguation still happens once, at
    scan time (the LLM has full context on which canonical sense, or
    which restaurant-specific novel sense, applies), it just resolves
    into "which restaurant's field this entry gets written into" rather
    than a tag the render side has to match against.
  - **Live-parse at render time** (unchanged from earlier passes, still
    the right call): matches current description text against
    `restaurant.glossaryTerms` fresh on every render — self-healing if a
    description gets reworded, since nothing cached can go stale for
    terms the glossary already knows about.
  - **Refresh command** (unchanged): a script that re-scans one
    restaurant's *current* menu against the canonical `glossary`
    collection, reusing existing definitions where they apply and
    generating new ones where they don't, then updates that restaurant's
    `glossaryTerms` field. Solves a different problem than live-parse —
    live-parse can't discover a genuinely *new* term that just got added
    to a menu, only re-match against terms it already knows. Run
    manually/periodically ("if the menu drifts far enough"), same
    deliberate, reviewed cadence as the initial batch scan, not an
    automatic trigger.

### Superseded reasoning (kept for context, not the active design)

- Considered a `glossary` Firestore collection, generated `g-{unique}`
  doc ids (reversed from an initial slugified-natural-key pass once the
  disambiguation requirement below was raised — `glossary` looked
  structurally closer to `learn-progress` than to `db-users.cjs`, since
  the real key isn't just the term string, it's (term, context)).
  - **Disambiguation, worked through in this shape**: an item-level
    reference baked onto the menu item at scan time (`glossaryTerms:
    [{term, glossaryId}]`) was rejected — two sources of truth (live
    description text vs. a frozen reference list) that drift silently
    out of sync whenever a description is edited without re-running the
    scan. Replaced with a live parse, matched fresh against the current
    description every render — self-healing by construction. This
    reasoning still holds under the file-based design: same live-parse
    approach, just matching against the JSON file's contents instead of
    a fetched Firestore collection.
  - **The read-cost problem that motivated moving off Firestore**: one
    document per term/sense means fetching "the whole glossary" costs
    one Firestore read *per term*, every time a user's cache is cold —
    worse than `restaurant-menus`' shape (one document per restaurant,
    whole menu nested inside, one read regardless of item count). The
    fix within Firestore would have been collapsing to one document
    holding every term (a `glossary` collection with a single document),
    matching `restaurant-menus`' pattern — but the file-based approach
    goes further and removes the question entirely.
  - **Why the term count would likely have stayed bounded anyway**:
    unlike menu items (linear growth — every new restaurant adds
    genuinely new items), the glossary's vocabulary should grow
    sub-linearly, since most new restaurants reuse culinary terms already
    in the glossary rather than introducing new ones. Still true and
    still relevant under the file-based design — it's part of why a
    single static file staying small is a safe bet, not just a Firestore
    cost argument.
  - Disambiguation between multiple senses of the same term (e.g. "salsa
    verde") uses a `_cuisineType` field per sense, matched against a
    cuisine signal on the dish itself — needs to live at the
    section or item level, not the restaurant level, since one restaurant
    (Margaritaville) can plausibly span more than one cuisine across its
    own menu. Decided at scan time, same as the definitions themselves —
    the LLM already has a dish's cuisine context when it's looking at it.
  - Matching by `_name` still matters at *scan* time, to check whether an
    entry for that sense already exists in the JSON before the scan adds
    a duplicate for the same actual meaning.

## Open questions (not yet decided)

- **Generation timing**: batch-and-review upfront (scan the whole menu
  once, Erik approves/edits before it's live) vs. generate-on-first-tap
  (simpler, but a trainee could be the first to see an unreviewed
  answer). Leaning batch-and-review to match the correction flow's
  existing pattern, but not confirmed.
- **Term matching in rendered descriptions AND item names**: scope isn't
  just `item.description`/`item.notes` — item *names* carry qualifying
  terms too (real example: "Tuna Tonnato" — tonnato is exactly the
  "named preparation whose nature isn't self-evident" case the rubric
  already covers, it just happened to show up in the dish's name rather
  than its description). The rubric itself doesn't change — it's about
  whether a term qualifies, not where it appears — but both the scan
  (needs to read `item._name`/`item.name` as a source, not just
  description/notes) and the render-side matching (needs to wrap matches
  in `.menu-item__name`, not just `.menu-item__desc`/`.menu-item__notes`,
  in `renderCategoryList`) need to cover it. Exact-string match against
  the glossary's known terms list is the obvious starting approach, but
  multi-word terms ("pico de gallo," "queso fresco") and
  case/pluralization need handling.
- **Popover UI**: reuse an existing pattern in this app if one fits
  (`[data-tooltip]` in `_learn.scss` is a hover-only tooltip, not tap-
  friendly for mobile — this needs a real tap-to-open popover, closer to
  the correction-card pattern than the tooltip pattern).
- **Where the scan runs**: a one-off script (like a seed script) vs. a
  Netlify function Erik can re-trigger as menu items are added — probably
  starts as the former, given this app's existing pattern of manual seed
  scripts for restaurant data.

## Verification

Not applicable yet — this ticket needs the open questions above resolved
into a real design (with Erik, before implementation) before there's
anything to verify.
