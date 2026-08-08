# Ticket 7: management/employee competency view

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). This
ticket builds a rough, demo-oriented management view on top of data
Tickets 4/5 already make real: restaurant-scoped Firestore progress,
read via `learn-progress-get.cjs` (Ticket 5). See `docs/VISION.md`'s
"Staff-Facing Experience" section — this view is the already-seeded
"manager/GM-facing view" idea, now actually getting built.

**Depends on Ticket 5** specifically for `learn-progress-get.cjs` — this
ticket is the second real consumer of that read path (the first being
the drill/picker's own hydration). **Depends on Ticket 4** for
restaurants existing as switchable entities. Does not depend on Ticket 6
(the four PoC competencies have no coverage data to show yet regardless
of whether Ticket 6 is built).

**Why this is scoped the way it is**: the honest end-state (real
employee accounts, real shift/scheduling integration, multi-employee
rosters) needs real identity/auth, which doesn't exist in this app and
is a substantial separate project — not something to build as a
prerequisite for a demo. Scoped down deliberately, per direct
discussion: single hardcoded employee ("Erik Burns," since he's
currently the only real user), no auth, no gating, just a mode toggle
and a read-only view. "Shift analytics" (real scheduling data) was
considered and dropped — Erik will make that case verbally to GMs rather
than build it; the view shows competency tiers, not schedules.

## Phase 0: Explore First

- `apps/tico-talk/netlify/functions/learn-progress-get.cjs` (Ticket 5) —
  the read endpoint this view calls directly, same as the drill/picker.
  No new backend read path needed.
- `apps/tico-talk/src/assets/js/utils/user-id.js`'s `getOrCreateUserId()`
  (Ticket 2) — this view shows *this browser's own* tracked progress,
  labeled with a hardcoded display name, not a real lookup by employee.
  Re-read the design note below before assuming otherwise.
- `apps/tico-talk/src/styles/_components.scss:237-262` — the 4-dot
  tier system (`.tier-dots`/`.tier-dot.is-filled`/`.tier-indicator__label`),
  reused again here, third context after the skill tree and the Learn
  picker.
- `apps/tico-talk/src/_includes/nav.njk` — the sidemenu-footer area
  (`sidemenu-auth`, near Sign out/profile) is where the mode-toggle link
  lands.
- `apps/tico-talk/src/assets/js/restaurant.js` (Ticket 4) —
  `getCurrentRestaurantId()`, reused so the management view reflects
  whichever restaurant is currently selected, not a separate concept.

## Overview

1. A mode-toggle link (sidemenu footer, near Sign out/profile) that
   navigates into `/management/` — no auth check, purely a UI switch.
2. A minimal, separate layout for management pages — not a full
   reuse of the hamburger sidemenu (that's the training-mode nav, and
   forcing it to also serve management mode's very different content
   would mean threading mode-conditionals through a shared partial for
   what's currently a single page). Just a simple header (restaurant
   name + "Exit management view") — can grow into something heavier
   once there's more than one management page to navigate between.
3. The view itself: a competency tree for one hardcoded employee ("Erik
   Burns"), scoped to the currently-selected restaurant, showing real
   tiers for Menu (from Ticket 5's coverage data) and honest "not yet
   tracked" states for the other five competencies.

**Design note — this is the same browser's own data, relabeled, not a
real employee lookup**: `getOrCreateUserId()` already returns a stable
id for whoever's using this browser. The management view fetches *that*
id's progress via `learn-progress-get.cjs` (same call the drill/picker
already makes) and displays it under a hardcoded "Erik Burns" label.
This is not the same as "an employee record" — a different browser or a
cleared localStorage means a *different* anonymous id with no progress,
same limitation Ticket 5's design note already flags for the training
side. Fine for a single-user demo, explicitly not what a multi-employee
roster would need (that requires real identity, out of scope, see
`docs/VISION.md`'s Open Questions).

**Design note — no gating, mode toggle only**: the switch into
"management view" is not a security boundary, it's a UI state. Anyone
using the app can click it. Real access control is a "build later if
the demo specifically needs it" decision, not a prerequisite — stated
directly during design, not an oversight.

**Design note — only Menu has real tiers to show**: Off-Menu isn't
built yet (blocked on its own content-sourcing workflow). Recommendations/
Upselling/Complaints/Languages (Ticket 6, if built by this point) are
explicitly untracked, no coverage/tier machinery per that ticket's own
scope decision. The view should say "not yet tracked" honestly for
those five, not fabricate a plausible-looking tier — same data
principle (`docs/VISION.md`) applied to the UI layer, not just menu
content.

## File 1: `src/_includes/nav.njk` (MODIFY)

Add the toggle near the existing auth row:

```html
<!-- Before -->
<div class="sidemenu-auth">
  <a href="/profile/" class="sidemenu-auth-profile">
    <span class="sidemenu-auth-avatar" aria-hidden="true">🧑</span>
    <span class="sidemenu-auth-name">Erik</span>
  </a>
  <a href="#" class="sidemenu-auth-link">Sign out</a>
</div>

<!-- After -->
<div class="sidemenu-auth">
  <a href="/profile/" class="sidemenu-auth-profile">
    <span class="sidemenu-auth-avatar" aria-hidden="true">🧑</span>
    <span class="sidemenu-auth-name">Erik</span>
  </a>
  <a href="#" class="sidemenu-auth-link">Sign out</a>
</div>
<a href="/management/" class="sidemenu-auth-link sidemenu-auth-link--management">Management view</a>
```

## File 2: `src/_includes/management-base.njk` (NEW) — minimal layout

A separate base layout (not `base.njk`, not the hamburger sidemenu),
used only by management pages:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title or "Management — Tico" }}</title>
  <link rel="icon" href="https://fav.farm/🌮">
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body class="management-mode">
  <header class="management-header">
    <span class="management-header__restaurant" id="management-restaurant-name"></span>
    <a href="/" class="management-header__exit">Exit management view</a>
  </header>
  <main class="management-main">
    {{ content | safe }}
  </main>
  {% if pageScript %}<script type="module" src="{{ pageScript }}"></script>{% endif %}
</body>
</html>
```

## File 3: `src/management.njk` (NEW)

```html
---
layout: management-base.njk
title: Management — Tico
permalink: /management/
pageScript: /assets/js/management.js
---

<h1 class="page-title">Erik Burns</h1>
<p class="management-subtitle">Competency overview</p>

<div class="management-competency-tree" id="management-competency-tree">
  <!-- populated by management.js -->
</div>
```

## File 4: `src/assets/js/management.js` (NEW)

```javascript
import { getOrCreateUserId } from './utils/user-id.js';
import { getCurrentRestaurantId } from './restaurant.js';

const COMPETENCIES = [
  { id: 'menu', label: 'Menu', tracked: true },
  { id: 'off-menu', label: 'Off-Menu', tracked: false },
  { id: 'recommendations', label: 'Recommendations', tracked: false },
  { id: 'upselling', label: 'Upselling', tracked: false },
  { id: 'complaints', label: 'Complaints', tracked: false },
  { id: 'languages', label: 'Languages', tracked: false },
];

// Same tier-from-coverage arithmetic as the picker (Ticket 5) —
// duplicated here rather than imported, since it's a handful of lines;
// worth extracting to a shared util if a third consumer shows up.
function tierFromProgress(sectionProgress) {
  if (!sectionProgress) return 'Not started';
  const items = Object.values(sectionProgress);
  if (!items.length) return 'Not started';
  const complete = items.every((i) => i.ingredients && i.dietary && i.pricing);
  if (complete) return 'Capable';
  const anyStarted = items.some((i) => i.ingredients || i.dietary || i.pricing);
  return anyStarted ? 'Training' : 'Not started';
}

async function render() {
  const restaurantId = getCurrentRestaurantId();
  document.getElementById('management-restaurant-name').textContent = restaurantId;

  const response = await fetch(`/api/learn-progress-get?userId=${encodeURIComponent(getOrCreateUserId())}&restaurantId=${encodeURIComponent(restaurantId)}`);
  const { progress } = await response.json();

  const tree = document.getElementById('management-competency-tree');
  COMPETENCIES.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'management-competency-row';
    if (!c.tracked) {
      row.innerHTML = `<span class="management-competency-row__label">${c.label}</span><span class="management-competency-row__status">Not yet tracked</span>`;
    } else {
      // Menu's progress is per-section — roll up to one overall tier
      // for this v1 rather than showing a per-section breakdown here;
      // revisit if a GM demo specifically wants section-level detail.
      const sections = Object.values(progress || {});
      const tiers = sections.map(tierFromProgress);
      const overall = tiers.includes('Capable') ? 'Capable' : (tiers.includes('Training') ? 'Training' : 'Not started');
      row.innerHTML = `<span class="management-competency-row__label">${c.label}</span><span class="management-competency-row__status">${overall}</span>`;
    }
    tree.appendChild(row);
  });
}

render();
```

The "roll every section up to one tier" simplification is a real
judgment call, not hidden: Menu currently tracks per-section coverage
(Starters, Tacos, ...), and this v1 just shows whichever tier is
highest across all of them rather than a full per-section breakdown.
Reasonable for a first pass; note it explicitly if a GM demo specifically
asks "which sections, not just overall."

## File 5: `src/styles/_management.scss` (NEW), added to `main.scss`

```scss
.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $space-md $space-lg;
  border-bottom: 1px solid $color-border;
}

.management-competency-row {
  display: flex;
  justify-content: space-between;
  padding: $space-md 0;
  border-bottom: 1px solid $color-border;
}

.management-competency-row__status {
  color: $color-text-muted;
  font-weight: 600;
}
```

Exact visual treatment (whether tier shows as text, as `.tier-dots`,
color-coded) is a judgment call once real data is in front of you —
text is the minimum viable version, upgrade to the dot system if it
reads better for a GM audience.

## Verification

1. `node --check` on `management.js`.
2. `sass` compile / full `pnpm build`.
3. Via `netlify dev`: complete some Menu coverage for a section (Ticket
   5's flow), then click "Management view" from the sidemenu. Confirm:
   - The view loads outside the normal hamburger sidemenu, with just the
     restaurant name + exit link.
   - Menu shows a real tier reflecting actual progress, not a
     placeholder.
   - The other five competencies show "Not yet tracked," not a
     fabricated tier.
4. Switch restaurants (Ticket 4), re-enter management view. Confirm it
   reflects the newly-selected restaurant's own progress, not the
   previous one's.
5. Clear this browser's localStorage/use a different browser profile,
   confirm the management view is honest about showing no progress
   rather than erroring — this is the known "same browser only"
   limitation, worth seeing once rather than assuming.

## Prerequisite

None new beyond Tickets 4/5's existing Firestore setup.
