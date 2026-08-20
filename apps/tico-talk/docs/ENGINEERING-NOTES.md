# Engineering Notes — Tico

Conventions adopted while building, worth following in new code rather
than re-deciding each time. Not product/mechanic design (see `VISION.md`/
`DESIGN.md`) — this is code-level "how we do things here."

## Accessible names for custom-tooltipped terms: visually-hidden text, not `aria-label`

**Convention**: when a term/abbreviation has a custom hover tooltip (a
`data-tooltip` attribute + JS-positioned popup, not the native
`title=""` tooltip), give it an accessible expansion via a visually-
hidden inline span, not `aria-label`.

```html
<abbr class="term" data-tooltip="Full expansion text">TERM
  <span class="sr-only"> (Full expansion text)</span>
</abbr>
```

```scss
// src/styles/_base.scss
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Why**: `aria-label` seemed like the obvious accessible-name pairing for
a custom tooltip, but it triggered a second, native-looking overlay
independent of our CSS (almost certainly a browser accessibility-
inspector/extension rendering `aria-label` on hover) — visually stacking
on top of the real custom tooltip. Removing `aria-label` outright would
have "fixed" the visual bug by silently dropping the accessible name for
real screen reader users, which is the wrong trade. Visually-hidden text
sidesteps the conflict entirely (it's not `aria-label`, so whatever was
rendering that overlay has nothing to key off) while being *more*
robust than `aria-label` generally: it's read by every screen reader
without exception, doesn't depend on `aria-label` announcement
conventions varying slightly engine to engine, and degrades gracefully
(if CSS fails to load for any reason, the text is still there, just
visible).

**When this applies**: any custom-tooltipped term/abbreviation going
forward (not just PPA on `/insights/demo/`, where this was first hit).
Reference implementation: `src/marketing/insights-demo.njk`'s `PPA`
abbr instances + `src/assets/js/utils/tooltip.js`.

## Custom tooltips over scrollable containers

**Convention**: a CSS `::after`-based tooltip gets clipped by any
scrollable ancestor (`overflow-x: auto`, etc.) — a JS-positioned tooltip
appended to `<body>` and placed via `getBoundingClientRect()` doesn't
have this problem, since it isn't a descendant of the clipping element.

**Why**: hit this exactly on `/insights/demo/`, where both the data
tables and the revenue chart scroll horizontally on narrow viewports —
a `::after` popup on a table-header abbreviation or a chart bar got cut
off mid-text instead of floating above the scrollable region.

**Reference implementation**: `src/assets/js/utils/tooltip.js`
(`initTooltips()` — call it once per page that needs `data-tooltip`
support; it binds to every matching element already in the DOM at call
time).
