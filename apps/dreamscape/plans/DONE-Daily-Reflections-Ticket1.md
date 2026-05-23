# Ticket 1: History Fix + Reflect Navigation Entry Points

## App Context
Dreamscape is a presence-based practice timer app in the HabitualOS monorepo (`apps/dreamscape`).
- Frontend: 11ty + Nunjucks, vanilla JS ES modules
- Backend: Netlify Functions (Node.js CJS)
- Database: Firestore via `@habitualos/db-core`
- Styles: SCSS compiled to `/styles/main.css` via 11ty (no build step needed in dev)
- Dark mode only. Nature/presence aesthetic. No uppercase/all-caps ever. No emojis.

**Local dev:** `npm run dev` (runs 11ty + Netlify dev at http://localhost:8888)

## Overview
This ticket does two things:
1. Fixes a bug in the Ago (history) page that prevents sessions from displaying
2. Adds "Reflect" navigation entry points (nav menu + homepage link) for the upcoming AI chat feature

No other tickets need to be complete for this one to work.

---

## Task 1: Fix `src/assets/js/pages/history.js`

### The Bug
`renderSessions()` at line 37 calls `document.getElementById('session-list')` but the HTML element in `src/history.njk` uses `id="session-feed"`. The function also references `session-empty` which doesn't exist in the HTML.

### Current Code (lines 36-64 of history.js):
```javascript
function renderSessions(sessions) {
  const list = document.getElementById('session-list');   // ← WRONG ID
  const empty = document.getElementById('session-empty'); // ← DOESN'T EXIST
  if (!list) return;

  if (!sessions.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  const sorted = sessions.slice().sort((a, b) => { ... });
  list.innerHTML = sorted.map(s => { ... }).join('');
}
```

### Fixed Version — replace the entire `renderSessions` function with:
```javascript
function renderSessions(sessions) {
  const feed = document.getElementById('session-feed');
  if (!feed) return;

  if (!sessions.length) {
    feed.innerHTML = '<p class="empty-state">Nothing yet.</p>';
    return;
  }

  const sorted = sessions.slice().sort((a, b) => {
    const aAt = a.stoppedAt?.seconds ? a.stoppedAt.seconds * 1000 : (a.startedAt || 0);
    const bAt = b.stoppedAt?.seconds ? b.stoppedAt.seconds * 1000 : (b.startedAt || 0);
    return bAt - aAt;
  });

  feed.innerHTML = sorted.map(s => {
    const startMs = s.startedAt instanceof Object ? s.startedAt?.seconds * 1000 : s.startedAt;
    return `
      <div class="session-row">
        <div class="session-type">${escapeHtml(s.practiceType || 'Practice')}</div>
        <div class="session-meta">
          ${s.duration ? formatDuration(s.duration) + ' · ' : ''}${relativeTime(startMs)}
        </div>
        ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
      </div>`;
  }).join('');
}
```

The "Loading your journey…" `<p>` in the HTML serves as the initial loading state; replacing `#session-feed`'s innerHTML on load clears it naturally.

---

## Task 2: Add session row styles to `src/styles/_components.scss`

The SCSS variables available (from `src/styles/_variables.scss`):
```scss
$color-bg:         #0d0c1a;
$color-bg-surface: #13121f;
$color-text:       #e5e3f5;
$color-text-muted: #9ca3af;
$color-border:     #2a2845;

$font-size-sm:   0.875rem;
$font-size-base: 1rem;
// Cormorant Garamond is loaded via Google Fonts in base.njk
```

Append these styles to `src/styles/_components.scss`:
```scss
// ─── Session feed (History / Ago page)
.session-feed {
  padding: 0 1.5rem 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.session-row {
  padding: 1.1rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child { border-bottom: none; }
}

.session-type {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.1rem;
  font-weight: 400;
  color: $color-text;
}

.session-meta {
  font-size: $font-size-sm;
  color: $color-text-muted;
  margin-top: 0.2rem;
}

.session-note {
  font-size: $font-size-sm;
  font-style: italic;
  color: $color-text-muted;
  opacity: 0.8;
  margin-top: 0.35rem;
  line-height: 1.5;
}
```

---

## Task 3: Add "Reflect" to nav in `src/_includes/nav.njk`

### Current nav list (relevant excerpt):
```html
<ul>
  <li><h3><a href="/">Home</a></h3></li>
  <li id="about-nav-link" hidden><h3><a href="/about/">About</a></h3></li>
  <li data-auth-only hidden><h3><a href="/practice/">Practice</a></h3></li>
  <li data-auth-only hidden><h3><a href="/circle/">Chimes<span id="nav-circle-badge" class="nav-badge" hidden></span></a></h3></li>
  <li data-auth-only hidden><h3><a href="/history/">Ago</a></h3></li>
</ul>
```

### Change: Insert Reflect after Practice
```html
<li data-auth-only hidden><h3><a href="/practice/">Practice</a></h3></li>
<li data-auth-only hidden><h3><a href="/reflect/">Reflect</a></h3></li>  ← ADD THIS LINE
<li data-auth-only hidden><h3><a href="/circle/">Chimes...
```

The `data-auth-only hidden` pattern is handled by `navigation.js` which shows these elements when the user is authenticated. No other changes needed.

---

## Task 4: Add "reflect" link to homepage `src/index.njk`

### Current homepage content area (relevant excerpt):
```html
<div class="blossom-content">
  <div id="wind-chime">{% include "wind-chime.njk" %}</div>
  <div class="feed-message feed-visible" id="feed-message">...</div>
  <a href="/practice/" class="practice-pill">practice</a>
</div>
```

### Change: Add reflect-pill after practice-pill
```html
  <a href="/practice/" class="practice-pill">practice</a>
  <a href="/reflect/" class="reflect-pill" id="reflect-pill" data-auth-only hidden>reflect</a>  ← ADD
```

Note: `data-auth-only hidden` — if navigation.js handles all `[data-auth-only]` elements page-wide, this will be shown automatically when signed in. If it only handles nav elements, you'll also need to add Task 5 below.

---

## Task 5: Show reflect-pill in `src/assets/js/pages/home.js` (if needed)

If adding `data-auth-only` to the reflect-pill in Task 4 doesn't work (i.e., navigation.js only targets nav elements), add explicit show logic to home.js.

Add this near the bottom of home.js (after the welcome state block, before `setSkyGradient()`):

```javascript
// Show reflect link for authenticated users
import { isSignedIn } from '../auth/auth.js';
// ... add to top of file imports ...

// Near bottom of module:
if (isSignedIn()) {
  document.getElementById('reflect-pill')?.removeAttribute('hidden');
}
```

The auth module is at `src/assets/js/auth/auth.js`. It exports `isSignedIn()` which reads `localStorage.getItem('dp-signed-in') === 'true'`.

---

## Task 6: Add reflect-pill styles to `src/styles/_components.scss`

The `.practice-pill` already has styles in `_components.scss`. Look up those styles and create a visually secondary `.reflect-pill` that matches the design language but is less prominent.

Append to `_components.scss`:
```scss
// ─── Reflect pill (secondary, below practice pill on homepage)
.reflect-pill {
  display: inline-block;
  margin-top: 0.6rem;
  font-size: 0.85rem;
  opacity: 0.55;
  text-decoration: none;
  color: $color-text;
  letter-spacing: 0.02em;
  transition: opacity 0.2s;

  &:hover { opacity: 0.85; }
}
```

Adjust sizing/spacing to visually sit below the practice pill without competing with it.

---

## Verification

1. Sign in → navigate to `/history/` → sessions load and display in the feed. "Ago" heading preserved. If no sessions: "Nothing yet." message.
2. If there are sessions: each shows practice type (serif), duration + relative time (muted small), note below if present.
3. Open nav while signed in → "Reflect" link visible between Practice and Chimes.
4. Homepage while signed in → "reflect" link visible below "practice" pill (smaller, less prominent).
5. Homepage while signed OUT → "reflect" link NOT visible (still hidden).
6. No `console.log` calls added (use `log()` from `../utils/log.js` if needed).
