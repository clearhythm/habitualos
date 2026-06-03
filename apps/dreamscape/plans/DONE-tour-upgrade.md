# Tour Upgrade

## Status
Complete.

---

## What Was Built

### Architecture
The tour is a dedicated route (`/tour/`) — not an overlay, not page params. Each slide is a screen within that route, driven by `?screen=N` in the URL. Browser back button works naturally via `history.pushState` + `popstate`.

### Routes
| URL | Screen | Description |
|---|---|---|
| `/tour/` | 0 — Welcome | Entry point for new users |
| `/tour/?screen=1` | 1 — Practice | Practice page preview |
| `/tour/?screen=2` | 2 — Reflect | Reflect page preview |
| `/tour/?screen=3` | 3 — Circle | Circle page preview |

### New User Flow
- `signup.js` and `signin.js` (invite flow) redirect to `/tour/` directly
- Edge function (`auth.ts`) intercepts, routes through `/audio-splash/?next=/tour/` if no audio pref cookie
- After audio choice → lands on `/tour/` (Welcome slide)
- User's chime plays on welcome slide load

### Sidemenu "Tour" link → `/tour/` (returns to welcome slide for returning users)

### Composable Widgets (DRY pattern)
Each page's content is extracted into a composable module used by both the real page AND the tour slide.

| Module | Used by | What it renders |
|---|---|---|
| `src/assets/js/components/circle-list.js` | `circle.js` + tour slide 3 | Full widget: header (Name / Celebrate ▾ sort), sortable rows, thread interaction, send note, mark read |
| `src/assets/js/components/reflect-input.js` | `reflect.njk` + tour slide 2 | Chat footer: textarea + send button; `onTap` exits tour to `/reflect/` |

### Icon System
- SVGs extracted to `src/assets/images/` (chime, reflect, circle, ago)
- 11ty `svgIcon` shortcode added to `eleventy.config.js` — templates use `{% svgIcon "name" %}`
- Tour fetches SVGs at runtime via `fetch('/assets/images/name.svg')`

### Chime Behavior
- `swingChime(wrapEl)` shared from `chime.js` — used by home.js and tour.js
- Tour welcome + practice slides: tapping the chime icon swings it; after swing it rests (`.chime-at-rest`)
- Home page: chime swings on state transitions (queue, caught-up, click)

### Home Page
- Welcome state removed entirely — home is idle-only
- `showWelcomeActions`, `launchTour`, LS flag (`dp-welcome-from`, `dp-first-visit`) all gone

### Slide Details

**Screen 0 — Welcome**
- Background: time-of-day sky gradient
- Icon: chime (with idle sway, swings on tap)
- Title: "Welcome" / "a beautiful journey awaits you"
- CTA: "let's begin" → screen 1
- Sublink: "skip" → `/`
- User's chime plays on load

**Screen 1 — Practice**
- Background: dark (matching real practice page)
- Icon: chime
- Title: "Practice" / "awaken a beautiful world"
- CTA: "continue" → screen 2
- Sublink: "practice" → `/practice/`
- Widget: **PENDING** — see remaining work below

**Screen 2 — Reflect**
- Background: `linear-gradient(to bottom, #0d0c1a, #13121f 70%, #0a0917)`
- Icon: reflect leaf
- Title: "Reflect" / "shine a little light on your path"
- CTA: "continue" → screen 3
- Sublink: "reflect" → `/reflect/`
- Widget: reflect input (from `reflect-input.js`) — time-of-day placeholder, tap exits to `/reflect/`

**Screen 3 — Circle**
- Background: `#0d0c1a`
- Icon: circle
- Title: "Circle" / "share support with friends"
- CTA: "begin" → `/` (home)
- Sublink: "invite" → `/invite/`
- Widget: full circle list (from `circle-list.js`) — sortable, interactive, real data

---

## Remaining Work — Practice Slide Composable

### Goal
Screen 1 (Practice) should look like the actual practice page — not the sky bg welcome variant. Currently it shares the sky bg and chime icon with the Welcome slide, making the two look identical. The practice slide should show the real practice UI below the tour header.

### Design
- **Background**: dark (same as real practice page: `linear-gradient(to bottom, #0d0c1a, #13121f 70%, #0a0917)`)
- **Icon**: chime (small, header-style)
- **Below tour header**: practice page content — input field, example tags, settings rows
- **No "begin" button** in tour mode (that's the offramp to the real page)
- Settings rows **should be interactive** — they save to localStorage and carry over when the user actually starts their first practice. Nice UX: they configure their practice during the tour.

### Implementation — same DRY pattern as circle and reflect

**New file: `src/assets/js/components/practice-setup.js`**

```js
export function renderPracticeSetup(container, { interactive = true } = {}) {
  // Renders the practice field (input + examples) and settings rows
  // Same HTML/CSS as practice.njk's .practice-setup content
  // No begin button
  // If interactive: settings rows save to localStorage via practice-settings.js
  // Returns teardown fn
}
```

**`practice.njk`**: Replace inline `.practice-setup` content with `renderPracticeSetup()` call from `practice.js` (or keep static HTML and have composable render an equivalent for tour — same CSS classes ensure styling is always in sync).

**`tour.js` slide 1**: `widget: 'practice'`, calls `renderPracticeSetup(widgetEl)`.

### Note on DRY strategy
Same principle as `circle-list.js`:
- The composable owns the rendering of the practice content
- `practice.js` uses it for the real page
- `tour.js` uses it for the slide widget
- CSS classes are the single source for styling — any visual change to the practice UI propagates automatically to the tour
- The "begin" button is excluded from the composable (it's page-specific behavior, not part of the reusable widget)
