# TICKET: Extract widget CSS into scoped widget.scss

## Why this exists

Widget CSS currently lives in two bad places:
1. `src/styles/_widget.scss` — 3000 lines mixing widget styles with dashboard, homepage, auth forms, and more. The widget-specific rules are not separable at a glance.
2. `src/assets/js/embed.js` — CSS hand-coded as JS string arrays, unmaintainable, diverged from the site styles.

The goal: one `src/widget/widget.scss` file containing only widget CSS, written cleanly (no JS string arrays), scoped with a container selector instead of a `se-` prefix, importable by the esbuild bundle (Ticket 1) so it self-injects on any site.

**Prerequisite**: TICKET-esbuild-pipeline must be complete. The esbuild pipeline must be running with `esbuild-sass-plugin` so that `import './widget.scss'` in JS compiles and inlines the CSS.

## The scoping strategy

Instead of `se-` prefixed class names (`.se-modal`, `.se-chat`), scope via the widget's root container ID:

```scss
// widget.scss
#signal-embed-overlay {
  .modal    { ... }
  .left     { ... }
  .chat     { ... }
  // etc.
}
```

This gives full CSS isolation on any host site (no class name collisions) without prefixing anything. Class names can be clean and readable. The container ID `#signal-embed-overlay` is injected by embed.js so it's always present when the CSS runs.

**Result**: drop the `se-` prefix convention entirely in the new widget source.

## What to build

### 1. Create `src/widget/widget.scss`

Extract all rules relevant to the widget modal from `src/styles/_widget.scss`. Scope everything under `#signal-embed-overlay`. Use clean class names (no `se-` prefix).

The widget modal structure (reference for what needs styling):
```
#signal-embed-overlay         ← root / backdrop
  .se-modal                   → .modal
    .se-header                → .header
    .se-score-bar             → .score-bar (mobile)
    .se-body                  → .body
      .se-left                → .left (left panel)
        .se-tabs              → .tabs
        .se-tab               → .tab
        .se-profile           → .profile (profile tab content)
        .se-score             → .score (score tab content)
        .se-ring-wrap         → .ring-wrap
        .se-dims              → .dims
        .se-left-footer       → .left-footer
      .se-chat                → .chat (right panel)
        .se-persona-wrap      → .persona-wrap
        .se-messages          → .messages
        .se-msg               → .msg (variants: --user, --assistant, --system, --eval)
        .se-thinking          → .thinking
        .se-input-wrap        → .input-wrap
        .se-nextstep          → .nextstep
        .se-lead              → .lead
```

Pull the visual values from two sources:
- `src/styles/_widget.scss` (the `signal-*` rules for the modal layout, score ring, dimensions, tabs, messages, form elements, mobile overrides)
- The inline CSS currently in `src/assets/js/embed.js` (the `se-*` rules — these contain the current embed visual design)

The visual design should match the current `signal-modal.js` experience (the richer two-panel design with Profile/Score tabs), since that is the canonical Signal widget UI.

Use SCSS variables for repeated values:
```scss
$surface: #0f172a;
$border: rgba(255, 255, 255, 0.06);
$accent: #c4b5fd;
$accent-bg: rgba(196, 181, 253, 0.15);
$green: #059669;
$send-btn: #6366f1;
```

### 2. Wire into esbuild entry

In `src/widget/index.js` (the esbuild entry point, created in Ticket 1):

```js
import './widget.scss';
// ... rest of widget logic
```

The `esbuild-sass-plugin` with `type: 'style'` compiles this to a JS snippet that injects a `<style>` tag on load. Verify the style tag appears in the DOM when embed.js loads.

### 3. What stays in `_widget.scss`

After extraction, `_widget.scss` should retain everything that is NOT the widget modal itself:
- Dashboard UI (tabs, upload area, sections)
- Auth forms (sign-in, verify)
- Evaluation cards (the standalone eval result pages)
- Homepage hero sections
- Score card carousel / sample score cards
- Site nav / footer overrides specific to Signal pages
- The `signal-modal-overlay` open/close animation (if it still references the old modal — can be deleted once Ticket 3 is complete)

Do **not** delete `signal-*` widget rules from `_widget.scss` yet — `signal-modal.js` still references them until Ticket 3 replaces it. Mark them with a comment: `// TODO: remove after TICKET-widget-js-modules ships`.

### 4. Verify visual parity

Load signal.habitualos.com locally (`npm run start`). The widget opened via the existing `signal-modal.js` should look identical to before — `_widget.scss` still provides its styles. The new `widget.scss` styles are only active when `embed.js` (the built bundle) injects them.

Once Ticket 3 ships (signal-modal.js replaced), run a visual comparison to confirm `widget.scss` covers everything.

## Current state (what exists)

- `src/styles/_widget.scss` — 3000 lines, widget + site styles mixed together
- `src/assets/js/embed.js` — inline CSS as JS string arrays (the `se-*` design)
- `src/assets/js/signal-modal.js` — uses `signal-*` CSS classes from `_widget.scss`
- Widget HTML uses `signal-*` classes (in `modal.njk`) on the Signal site
- Widget HTML uses `se-*` classes (injected by `embed.js`) on external sites

After this ticket: `src/widget/widget.scss` exists and is imported by `src/widget/index.js`. The Signal site still looks and works identically (signal-modal.js + _widget.scss untouched).

## Out of scope

- Do not change any JS logic
- Do not change `modal.njk` or `signal-modal.js`
- Do not rename class names in the existing HTML templates (those change in Ticket 3)
- Do not delete `signal-*` rules from `_widget.scss`

## Acceptance criteria

- [ ] `src/widget/widget.scss` exists with all widget modal CSS, scoped under `#signal-embed-overlay`
- [ ] `src/widget/index.js` imports `./widget.scss`
- [ ] The esbuild output (`src/assets/js/embed.js`) injects a `<style>` tag containing the widget CSS
- [ ] Signal site still looks and works identically (no visual regressions)
- [ ] SCSS uses variables for repeated color/spacing values
- [ ] No `se-` prefix in class names in the new file (scoping is via container ID)
