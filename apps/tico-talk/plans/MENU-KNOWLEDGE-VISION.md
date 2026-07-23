# Menu Knowledge — bigger app-model vision (not a spec, not scheduled)

Rough sketch of where the real practice app is headed, captured so it
doesn't get lost — deliberately NOT detailed enough to build from yet.
We don't know enough yet to spec this properly; it gets refined into a
real plan once there's more to learn from (starting with the reference
pages and, eventually, a real practice conversation).

## The two-part idea

1. **Menu/drink practice grouped per actual menu section** — Starters,
   Soup & Salad, Tacos, etc. (food) and Tiki Drinks, Margaritas, etc.
   (drinks) as their own practice units, not one monolithic "Menu
   Knowledge" blob covering the whole menu at once. This matches how a
   real live-practice session with Tico (playing both a guest and a
   coworker) naturally organized itself around one section at a time.

2. **A coverage map showing what's been learned** — per section/item,
   distinguishing:
   - not yet touched
   - attempted but shaky
   - demonstrated correctly

   This can likely double as the "am I progressing" signal on its own —
   watching it fill toward "confirmed correct" across a section probably
   doesn't need a separate competency score layered on top, as long as it
   tracks actual correctness, not just exposure. Worth testing that
   assumption once something exists to look at, not assuming it now.

## Explicitly not decided yet

- How practice sessions actually work technically (a real conversation
  loop, what backend, what data flows where).
- Whether "coverage" needs finer granularity than section-level, or
  section-level is enough.
- Anything about Recommendations & Upselling, Presentation, or other
  cross-cutting skills raised in earlier discussion — real ideas, not
  ready to plan.

## Data principle established while extracting the menu

The menu JSON (`src/_data/menus/margaritaville.json`) is the canonical
factual reference — scanned menu data, or confirmed real-world
corrections from actually working there (portion sizes, off-menu
customization, etc.). It should never contain AI-interpreted content
(a synthesized flavor description, an inferred pairing, anything not
independently verifiable). If that kind of color is ever wanted
somewhere, it happens live in a model call at request time — it doesn't
get stored as if it were fact.
