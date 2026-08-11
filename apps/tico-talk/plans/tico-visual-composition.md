# Visual composition engine: generated dish/drink visuals for the Review panel

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket adds a visual aid to the `/menu/` Review panel: a generated scene
with the dish/drink itself in the foreground and its actual ingredients
composed in the background, like a kitchen counter — not baked into one
generation, not icons/labels bolted on either (see "The core design
decision" below). Not built yet — captured from a live conversation with
Erik after he hit a real, in-the-moment wall trying to drill three pasta
dishes from text alone: "it's hard to get it with just words. like
legitimately hard."

**Reference image**: `plans/assets/visual-composition-reference.png` —
an AI-illustrated clams pasta Erik found and shared mid-conversation.
Genuinely useful as a **compositional** reference (foreground dish,
background raw ingredients at varied, sensible scale/depth — exactly the
"kitchen counter" idea) — not a confirmed **stylistic** target ("this
isn't really stylistically quite what I had in mind anyways," Erik's own
words), and not a demonstration of the actual mechanism (it's a found/
generated mood image, not something built from this app's real per-
ingredient asset library or real menu data). Useful for the composition
question, not yet useful for the style or implementation questions.

**Why this exists**: some dishes (composed ones especially — a pasta with
several components, a cocktail with multiple spirits/mixers) don't map
cleanly from a text ingredient list to a mental picture. This isn't a
polish request — it surfaced from real dogfooding, drilling actual
content, not from imagining a future need.

**Same underlying engine, two content types**: Erik's original framing
(from the glossary-idea conversation) was specifically about drinks —
composite the likely glass + a tidy visual group of the bottles/
ingredients that comprise it, so a trainee can *see* what a drink is made
of. Dishes are the same engine applied to food instead of drinks — one
visual composition system, not two separate features.

## The core design decision: two separate layers, not one generation

Two ideas were considered and explicitly rejected before landing here:

1. **Real photos, staff-supplied.** Rejected — "too much work for people
   to create this." Expecting every restaurant to photograph every dish
   doesn't scale for onboarding new restaurants easily, and generation
   needs zero restaurant participation. This also doesn't fit this app's
   existing pattern of low-friction data ingestion.
2. **One AI-generated image trying to depict the exact ingredient list
   accurately within the dish itself.** Rejected — image models are
   unreliable at correctly, verifiably depicting a *specific* ingredient
   list pictorially (can't guarantee every listed ingredient is visually
   present and correctly shown, or that nothing extra is implied). That
   would put factual weight on the generation, which conflicts directly
   with this app's "never fabricate" principle everywhere else.

**What's actually being built instead**: a foreground/background scene,
not a photo-plus-label-sidebar — imagine a kitchen counter as the
background, with the dish's real ingredients visually present on it, and
the finished dish itself in the foreground. The dish's own rendering
doesn't need to be representationally accurate to the exact preparation
— Erik's own words — its job is narrow and low-stakes: look *plausibly
iconic* for that dish/drink *type* ("pasta with clams," "a margarita"),
not prove anything about the specific ingredient list.

The ingredients themselves are what need to stay accurate, and the way
to do that without needing one generation call to correctly render an
entire complex scene with every fact baked in at once: each ingredient
gets its own small, reusable visual asset, built and verified *once* —
same reuse logic as the glossary's canonical definitions — then
*composed* onto the counter per-dish based on that dish's actual,
verified ingredient list. Composing a known-correct set of existing
assets is a fundamentally different (and much safer) problem than
generating one scene that has to get several specific facts right
simultaneously. The generative part (the ingredient asset library, built
once each) never carries per-dish factual weight; the verified menu data
decides which assets appear together for a given dish.

**Not free, even done this way**: decomposing it like this makes the
approach more *accurate*, not necessarily *easy* — actually building a
real ingredient asset library well (sourcing or generating each one,
getting the compositing/lighting/style to read as one coherent scene
rather than a collage) is genuine, nontrivial work either way. The
compositing step specifically is real stylist-level work, not just
placement: a garlic clove and a block of parmesan (Erik's own example)
need sensible relative scale, depth, and spacing to read as one
intentional arrangement, not a random collage of same-sized icons —
closer to art-directing a flat-lay food photo than laying out UI icons.

**Known, accepted quality variance — not a correctness risk**: dishes
vary in how "canonical" their look is. Pasta alle vongole has a strong,
consistent visual convention — a model will likely render it
recognizably almost every time. An unusual or invented combination
("squid pasta with puttanesca," Erik's own example) has no strong visual
consensus — the generated image might come out more generic/approximate.
That's an acceptable trade for a first version: quality variance, not a
wrong-facts problem, since the image was never claiming ingredient-level
precision in the first place.

## Open questions (not yet decided)

- **Generation mechanism**: which model/pipeline actually produces the
  dish-type image, when (batch, like the glossary's scan-and-review
  pattern, vs. on-demand), and whether there's a review step before an
  image goes live (same "never fabricate, always confirm" precedent as
  the glossary and correction flow, though the stakes are lower here
  since the image was never claiming factual precision to begin with).
- **The ingredient asset library itself**: how each ingredient's reusable
  visual asset actually gets made (photographed, illustrated, AI-
  generated once and reviewed) and how the "kitchen counter" compositing
  works technically — a real per-dish generation call assembling the
  right assets each time, vs. some other layout mechanism. Not yet a
  concrete implementation, just the design intent (foreground dish,
  background counter with the real ingredients on it).
- **Storage**: presumably a generated-image URL/reference living
  alongside the menu item's existing data (`restaurant-menus`), similar
  in spirit to how the glossary's resolved terms would hydrate onto a
  restaurant's own document — needs its own design pass once the
  generation mechanism is chosen.
- **Where this shows**: the Review panel is the obvious first surface
  (exactly where Erik hit the wall), but this may also matter for the
  browse list or elsewhere once it exists.
- **Cost/scale**: image generation has real per-image cost, unlike text.
  Whether generation happens once per dish (cached/reused forever, like
  the glossary's long-TTL caching) or has some other trigger needs
  thinking through — likely once-and-cached, given dishes don't change
  their fundamental "type" often even if a restaurant's specific
  preparation details do.

## Verification

Not applicable yet — this needs the generation mechanism and ingredient-
layer treatment decided (with Erik, before implementation) before there's
anything to build or verify.
