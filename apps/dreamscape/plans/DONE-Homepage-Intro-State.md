# Homepage — Intro State

## App Context

Dreamscape is a presence-based practice timer app (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS modules. No `console.log` — use `log()` from `src/assets/js/utils/log.js`. No uppercase/all-caps. Dark mode only.

**Local dev:** `npm run dev` from `apps/dreamscape/` (Netlify dev at http://localhost:8889 — port set in `netlify.toml` `[dev]`).

**Key files:**
- `src/index.njk` — homepage markup
- `src/assets/js/pages/home.js` — chime loop, `showFeedMessage()`, `SELF_CHIME`, audio init
- `src/styles/_components.scss` — chime and feed styles

---

## What This Ticket Builds

Four additive changes to the homepage. Nothing existing is removed or restructured.

1. **Alternating intro tagline** — the feed message on page load alternates between two phrases visit-to-visit
2. **User's chime on load** — own signature plays when audio is ready
3. **8s intro hold** — feed starts after 8 seconds instead of 3
4. **One-time chime hint** — chime pulses gently on first visit when a queue exists

---

## 1. Alternating Intro Tagline

Two phrases alternate visit-to-visit via a localStorage toggle (`dp-tagline-index`):

| Visit | Name | Subtitle |
|---|---|---|
| 0, 2, 4… | Practice | is only the beginning |
| 1, 3, 5… | Presence | is the gift of you being here |

### HTML — `src/index.njk`

Update the initial `feed-message` to the first tagline (JS will swap if needed before any paint):

```html
<div class="feed-message feed-visible" id="feed-message">
  <span class="feed-name">Practice</span>
  <span class="feed-time">is only the beginning</span>
</div>
```

### JS — `src/assets/js/pages/home.js`

Add before the init block:

```javascript
const TAGLINES = [
  { name: 'Practice',  sub: 'is only the beginning' },
  { name: 'Presence',  sub: 'is the gift of you being here' },
];

function getIntroTagline() {
  const idx = parseInt(localStorage.getItem('dp-tagline-index') ?? '0', 10);
  localStorage.setItem('dp-tagline-index', String((idx + 1) % TAGLINES.length));
  return TAGLINES[idx];
}
```

In the init block, apply the tagline immediately (no fade — it's the initial render):

```javascript
const tagline = getIntroTagline();
const feedEl = document.getElementById('feed-message');
if (feedEl) {
  feedEl.querySelector('.feed-name').textContent = tagline.name;
  feedEl.querySelector('.feed-time').textContent = tagline.sub;
}
```

This runs synchronously before any paint, so there is no flash of the wrong tagline.

---

## 2. User's Chime on Load

When `audioReady` fires, play `SELF_CHIME` once before the feed begins. Already defined in the file — just call `playSignature(SELF_CHIME)` at the start of `startChimeLoop()`.

```javascript
function startChimeLoop() {
  if (_loopStarted || _isWelcome) return;
  _loopStarted = true;
  playSignature(SELF_CHIME); // ← add
  maybeShowChimeHint();       // ← add (see item 4)
  _introTimer = setTimeout(runChimeLoop, INTRO_MS);
}
```

---

## 3. Eight-Second Intro Hold

Replace the current direct call to `runChimeLoop()` in `startChimeLoop()` with a timer. Also remove the existing 3-second `waitOrAdvance(3000)` at the top of `runChimeLoop()` — the intro timer is the new delay.

```javascript
const INTRO_MS = 8000;
let _introTimer = null;
let _loopRunning = false;
```

Update the chime click handler to cancel the intro timer and start the feed early:

```javascript
document.getElementById('wind-chime')?.addEventListener('click', () => {
  swingChime();
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

Set `_loopRunning = true` at the top of `runChimeLoop()`.

---

## 4. One-Time Chime Hint

On first visit where a feed queue exists, the chime pulses gently with an expanding ring — a quiet signal that there is something to see. Never shown again after that visit.

```javascript
const LS_CHIME_HINT = 'dp-chime-hint-seen';

function maybeShowChimeHint() {
  if (localStorage.getItem(LS_CHIME_HINT)) return;
  const hasQueue = MOCK_SESSIONS.length > 0; // replace with real check when Firestore data lands
  if (!hasQueue) return;
  document.querySelector('#wind-chime .wind-chime')?.classList.add('chime-hint-pulse');
  localStorage.setItem(LS_CHIME_HINT, '1');
}
```

### CSS — `src/styles/_components.scss`

```scss
// ─── One-time chime hint — expanding ring, first visit with queue only
@keyframes chime-hint-ring {
  0%   { box-shadow: 0 0 0 0px rgba(255, 255, 255, 0.18); }
  70%  { box-shadow: 0 0 0 20px rgba(255, 255, 255, 0); }
  100% { box-shadow: 0 0 0 0px rgba(255, 255, 255, 0); }
}

.wind-chime.chime-hint-pulse {
  animation: chime-idle 9s ease-in-out infinite,
             chime-hint-ring 2s ease-out 1.5s infinite;
}
```

The ring starts after 1.5s so the idle sway establishes first. Removed when the feed starts (intro timer fires or chime tapped).

---

## What Does NOT Change

- `showFeedMessage()` — untouched
- `runChimeLoop()` — only change: remove the initial `waitOrAdvance(3000)`
- `playSignature()`, `swingChime()`, `advanceChime()` — untouched
- `MOCK_SESSIONS` — untouched
- Practice pill, reflect link — untouched

---

## Deferred — Scene Sounds

Nature sounds (birds by time-of-day scene, tied to when the friend practiced) are a follow-on ticket. The `SCENE_FRAMES` data model and `playSceneSound()` function will live in a future `Homepage-Scene-Sounds.md` ticket.

---

## Verification

1. **Tagline alternates:** First load → "Practice / is only the beginning". Reload → "Presence / is the gift of you being here". Reload → back to Practice.
2. **User chime:** Own signature plays on `audioReady` (requires audio unlocked).
3. **8s hold:** Feed does not start until 8 seconds after audio ready.
4. **Early tap:** Tapping chime during intro skips to feed immediately.
5. **Chime hint:** First load with non-empty `MOCK_SESSIONS` → ring animation on chime. `dp-chime-hint-seen` set. Reload → no animation.
6. **No hint if no queue:** Clear `MOCK_SESSIONS` to `[]` → no ring animation.
7. **Welcome state:** `dp-welcome-from` or `dp-first-visit` in localStorage → existing welcome message shows, no tagline, no intro timer (existing `_isWelcome` guard).
