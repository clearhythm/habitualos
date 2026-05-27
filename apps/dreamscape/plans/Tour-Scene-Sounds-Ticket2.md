# Tour + Scene Sounds — Ticket 2: Welcome Tour

## App Context

Dreamscape (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS modules. No `console.log` — use `log()` from `src/assets/js/utils/log.js`. Dark mode only.

**Depends on:** Ticket 1 (nature sound engine) must be implemented first. `playSceneSound()` must exist and be callable.

**Local dev:** `npm run dev` from `apps/dreamscape/` (http://localhost:8889).

**Key files to read first:**
- `src/index.njk` — homepage markup; understand `.blossom-content`, `#feed-message`, `.practice-actions`, `#wind-chime`
- `src/assets/js/pages/home.js` — full file; understand `_isWelcome`, `showFeedMessage()`, `swingChime()`, `playSignature()`, `SELF_CHIME`, `MOCK_SESSIONS`
- `src/_includes/navigation.njk` — sidenav; understand where Settings + Sign out links live

---

## What This Ticket Builds

A 3-slide welcome tour for first-time users. Each slide tells one beat of the arrival story. The user advances by tapping the chime or clicking "tour" / "continue". A nature sound plays on each advance (from Ticket 1).

The Welcome state now persists across visits until the user completes their **first practice** — not just first page load.

---

## The Story

| Slide | Name | Subtitle | Primary | Secondary |
|---|---|---|---|---|
| 1 | Someone brought you here | Your practice matters to them | `[ Practice ]` | tour |
| 2 | When your circle practices | you'll see it here — and they'll see you | `[ Practice ]` | tour |
| 3 | Ready? | Reflect if you need help | `[ Practice ]` | reflect |

**Slide 1 detail:** If `dp-welcome-from` is set in localStorage, the inviter's name appears in the feed message area and their chime plays (use a default signature if no specific chime is stored). If no inviter, the feed shows "Your circle / is here with you."

**Slide 2 detail:** The feed cycles through `MOCK_SESSIONS` (one entry auto-advances after 3s, or on user tap) to demonstrate witnessing. This is NOT the full chime loop — just a single demo entry shown briefly.

**Slide 3:** Clicking `[ Practice ]` navigates to `/practice/` and ends the welcome state. Clicking `reflect` navigates to `/reflect/`. Both end the tour.

---

## Advancing the Tour

Two ways to advance from slide 1 → 2 → 3:
1. **Tap the chime** — `swingChime()` + `playSceneSound()` + advance slide
2. **Click "tour" / "continue" link** — same effect as chime tap, no swing

Clicking the **primary button** (`[ Practice ]`) on any slide navigates immediately and ends the tour — it does not advance to the next slide.

---

## Welcome State — Persistence Change

**Current behavior:** `dp-welcome-from` and `dp-first-visit` are removed from localStorage on first homepage visit.

**New behavior:** These keys persist until the user completes their first practice session. The practice page sets `dp-has-practiced = '1'` in localStorage on session complete. The homepage checks this key; if set, welcome state is skipped entirely.

Update in `home.js`:
```javascript
// OLD — removes on first visit:
// localStorage.removeItem('dp-welcome-from');
// localStorage.removeItem('dp-first-visit');

// NEW — only skip welcome if user has practiced:
const hasPracticed = localStorage.getItem('dp-has-practiced');
const welcomeFrom = localStorage.getItem('dp-welcome-from');
const firstVisit  = localStorage.getItem('dp-first-visit');

if (!hasPracticed && (welcomeFrom || firstVisit)) {
  _isWelcome = true;
  // ... run tour
}
```

Update in `src/assets/js/pages/practice.js` (or wherever session complete is handled) — on session end, add:
```javascript
localStorage.setItem('dp-has-practiced', '1');
```

---

## HTML Changes — `src/index.njk`

No structural changes needed. The tour runs entirely through the existing `#feed-message` and `.practice-actions` elements, driven by JS. The tour takes over those elements when `_isWelcome` is true, then releases them when the tour ends.

---

## JS Changes — `src/assets/js/pages/home.js`

### Tour state

```javascript
const TOUR_SLIDES = [
  {
    name:     () => localStorage.getItem('dp-welcome-from') || 'Someone',
    sub:      'brought you here. Your practice matters to them.',
    showDemo: false,
  },
  {
    name:     'When your circle practices',
    sub:      "you'll see it here — and they'll see you.",
    showDemo: true,
  },
  {
    name:     'Ready?',
    sub:      'Reflect if you need help.',
    showDemo: false,
  },
];

let _tourSlide = 0;

function showTourSlide(idx) {
  const slide = TOUR_SLIDES[idx];
  const name = typeof slide.name === 'function' ? slide.name() : slide.name;
  showFeedMessage(name, slide.sub);
  swingChime();

  // Slide 1: play inviter chime (or SELF_CHIME as fallback)
  if (idx === 0) playSignature(SELF_CHIME);

  // Slide 2: show a demo feed entry
  if (slide.showDemo && MOCK_SESSIONS.length) {
    const demo = MOCK_SESSIONS[0];
    setTimeout(() => showFeedMessage(demo.name, `practiced ${demo.lastPracticed}`), 1200);
  }

  // Update secondary link: "tour" on slides 0–1, "reflect" on slide 2
  const secondary = document.getElementById('secondary-link');
  if (secondary) {
    if (idx < TOUR_SLIDES.length - 1) {
      secondary.textContent = 'tour';
      secondary.removeAttribute('href');
      secondary.setAttribute('role', 'button');
    } else {
      secondary.textContent = 'reflect';
      secondary.setAttribute('href', '/reflect/');
      secondary.removeAttribute('role');
    }
    secondary.removeAttribute('hidden');
  }
}

function advanceTour() {
  playSceneSound();
  _tourSlide++;
  if (_tourSlide >= TOUR_SLIDES.length) {
    endWelcome();
    return;
  }
  showTourSlide(_tourSlide);
}

function endWelcome() {
  _isWelcome = false;
  startChimeLoop();
}
```

### Chime click — tour-aware

Update the chime click handler:

```javascript
document.getElementById('wind-chime')?.addEventListener('click', () => {
  swingChime();
  if (_isWelcome) {
    advanceTour();
    return;
  }
  if (_introTimer) {
    clearTimeout(_introTimer);
    _introTimer = null;
    document.querySelector('#wind-chime .wind-chime')?.classList.remove('chime-hint-pulse');
    if (!_loopRunning) runChimeLoop();
    return;
  }
  advanceChime();
});
```

### Secondary link click (tour/continue)

```javascript
document.getElementById('secondary-link')?.addEventListener('click', (e) => {
  if (_isWelcome && _tourSlide < TOUR_SLIDES.length - 1) {
    e.preventDefault();
    advanceTour();
  }
  // On last slide, secondary link is 'reflect' with href — default navigation applies
});
```

### Init — start tour if welcome state

In the welcome state block, replace the current one-time message with the tour:

```javascript
if (!hasPracticed && (welcomeFrom || firstVisit)) {
  _isWelcome = true;
  showTourSlide(0);
}
```

---

## Sidenav — "Tour" Link

In `src/_includes/navigation.njk`, add a "Tour" link above Settings and Sign out. Hidden until user has practiced (show only when `dp-has-practiced` is set — the welcome tour is no longer shown, but tour is still accessible).

```html
<a href="#" id="nav-tour-link" class="nav-link" hidden>tour</a>
```

JS in navigation.js (or home.js): show `#nav-tour-link` if `dp-has-practiced` is set. Clicking it resets `_tourSlide = 0`, sets `_isWelcome = true`, shows slide 0.

---

## What Does NOT Change

- `showFeedMessage()` — untouched
- `playSignature()` — untouched
- `MOCK_SESSIONS` — untouched (slide 2 uses first entry only as demo)
- `applyIntroTagline()` — only runs when `_isWelcome` is false; welcome state takes priority

---

## Verification

1. **Fresh user (dp-welcome-from set, no dp-has-practiced):** Tour shows on load. Slide 1 shows inviter's name in feed, chime plays.
2. **Slide advance via chime tap:** Sound plays, slide advances, secondary link updates.
3. **Slide advance via "tour" link:** Same effect as chime tap.
4. **Slide 2:** Demo feed entry appears after 1.2s showing a MOCK_SESSION name.
5. **Slide 3:** Secondary link shows "reflect" with href. Clicking navigates to /reflect/.
6. **Practice button on any slide:** Navigates to /practice/ immediately.
7. **After first practice:** `dp-has-practiced` set → homepage shows normal intro state, tour not shown.
8. **Sidenav tour link:** Visible only after first practice. Clicking replays tour from slide 1.
9. **No inviter:** Slide 1 feed shows "Someone / brought you here..." gracefully.
10. **Revisit before practicing:** Welcome state still shows (keys not removed on visit).
