# TICKET: Consolidate embed.js + signal-modal.js into one widget

## REASON FOR REVERTING
This ticked caused a massive refactor of the embedded widget into IIFE that pulled out JS and CSS into string literals and that removed all modularity from our codebase for this most central widget feature. It caused 2 different autonomous Claude agent browser cycles to eat up full 5-hour token allotments (without finishing) and almost entirely the full allotment when run locally. The results from this was we discovered that we needed to add a build pipeline to our project so that we could keep our codebase modular but also allow us to output a scope and hostable widget on any site.

I am GLADLY closing this ticket out as it caused an impressive amount of headache for myself and Claude. Claude was gracious about it though (although, to be fair, Claude authored this ticket. In our post-mortem, I will still hold myself accountable lol).

## Problem
Two widget implementations exist and have diverged:
- `embed.js` — old design, self-contained, used on external sites (erikburns.com)
- `signal-modal.js` + `modal.njk widget macro` — new Signal Interview UI, used on signal.habitualos.com

They should be one codebase. embed.js should BE the widget everywhere.

## Goal
One file (`embed.js`) that:
- Injects its own HTML (Signal Interview UI from modal.njk)
- Injects its own CSS (self-contained, no dependency on Signal site styles)
- Runs the signal-modal.js logic
- Works on any site via a single script tag
- Works on signal.habitualos.com full-page view too (auto-opens on load)

## What changes

### embed.js (rewrite)
- Inject Signal Interview HTML (converted from modal.njk widget macro to JS template literal)
- Inject all widget CSS (from _widget.scss, inlined as a style tag)
- Port signal-modal.js logic in: all DOM refs must move inside init() (currently at module parse time)
- Remove `import { apiUrl } from './api.js'` — inline BASE_URL logic already in embed.js
- Remove `window.__userId` dependency — embed.js already manages visitor/owner sessions
- Keep coming-soon modal as small flavor (already working)
- Keep `Signal.open()` as public API
- Favicon/asset paths must be absolute (signal.habitualos.com) not relative

### modal.njk widget macro
- Replace entire macro body with just a script tag:
  ```html
  <script src="/assets/js/embed.js" data-signal-id="{{ signalId }}" defer></script>
  ```
- Keep `confirm` macro unchanged

### base.njk
- Remove `<script type="module" src="/assets/js/signal-modal.js"></script>` (now loaded via embed.js)
- The widget macro call stays, just renders the script tag now

### signal-modal.js
- Delete after embed.js consolidation is verified

## Key technical constraints
- embed.js must be an IIFE (not ES6 module) so it works without a bundler on any host site
- All DOM queries must happen after HTML injection (not at parse time like signal-modal.js currently does)
- CSS must scope cleanly — use `.se-` prefix already in embed.js or match signal modal classes
- marked.js (markdown) must be loaded dynamically by embed.js, not assumed present

## Modes
- `data-signal-mode="coming-soon"` → small coming-soon modal (existing)
- `data-signal-mode="testing"` → same as coming-soon (existing alias)
- no mode attr → full Signal Interview widget (visitor mode by default)
- Signal site full-page: load embed.js + call `Signal.open()` on DOMContentLoaded, skip overlay backdrop

## Out of scope
- Streaming (separate ticket)
- Signal Evidence cards (separate ticket)
