# Plan: Homepage localStorage Cache

## What & Why

`/practice/` (homepage) currently fetches two endpoints on every page load — `practice-list` and `challenge-status` — causing a visible loading flash before content appears. The data only changes when a practice is logged, so we can cache it in `localStorage` and render immediately on every visit, with background fetches that silently update the display only when data has actually changed.

This solves two cases:
1. **Same device, active session** — navigating back to homepage after logging shows fresh data silently, no flash
2. **Different device / SMS log** — background fetch always runs and updates display if data changed

---

## App Context

- **App**: `apps/obi-wai-web/` — standalone 11ty + Nunjucks site, Netlify functions
- **Homepage**: `src/practice/index.njk` — has a `<script type="module">` with two async loaders: `loadStats()` and `loadChallenge()`
- **Log page**: `src/practice/log.njk` — has a form submit handler; on success shows a flower animation
- **No build step for JS** — all JavaScript is inline in Nunjucks templates or in `src/assets/js/`

### Current `loadStats()` flow (index.njk ~line 128)
Fetches `/.netlify/functions/practice-list?userId=X`, computes `totalCheckins`, updates `#rank-emoji`, `#rank-name`, `#rank-subtitle`.

### Current `loadChallenge()` flow (index.njk ~line 150)
Fetches `/api/challenge-status?userId=X`, sets module-scoped `challengeData`, updates `#challenge-streak-label`, builds the 31-square calendar grid in `#home-calendar`, calls `selectDay(data.dayNumber)`.

### `selectDay(day)` (index.njk ~line 197)
Uses `challengeData` (module-scoped variable) to style the day navigator and log buttons. Must be callable with cached data.

---

## localStorage Keys

| Key | Value shape | Purpose |
|-----|-------------|---------|
| `obi_stats_cache` | `{ totalCheckins: number, timestamp: number }` | Cached stats data |
| `obi_challenge_cache` | `{ data: object, timestamp: number }` | Full challenge-status response |
| `obi_cache_dirty` | `'1'` or absent | Set by log page after submit; advisory signal |

---

## Implementation

### File 1: `src/practice/index.njk`

**Location**: The `<script type="module">` block starting around line 103. Do NOT change any HTML — only the JavaScript inside the script block.

**Step 1 — Add cache helpers** after `const userId = initializeUser();`:

```javascript
// ── Cache helpers ────────────────────────────────────────────────
function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function saveCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ ...value, timestamp: Date.now() })); } catch {}
}
function challengeChanged(newData, cached) {
  if (!cached || !cached.data) return true;
  const d = cached.data;
  return newData.streak !== d.streak
    || newData.completedDays.join() !== d.completedDays.join()
    || (newData.partialDays || []).join() !== (d.partialDays || []).join();
}
// ────────────────────────────────────────────────────────────────
```

**Step 2 — Extract `renderStats(totalCheckins)` function**. Take the display logic out of `loadStats()` into a named function:

```javascript
function renderStats(totalCheckins) {
  const rank = getRank(totalCheckins);
  document.getElementById('rank-emoji').textContent = rank.emoji;
  document.getElementById('rank-name').textContent = rank.name;
  const c = totalCheckins;
  document.getElementById('rank-subtitle').textContent =
    `You logged ${c} ${c === 1 ? 'practice' : 'practices'}`;
}
```

**Step 3 — Rewrite `loadStats()`**:

```javascript
async function loadStats() {
  // Render from cache immediately (no flash)
  const cached = readCache('obi_stats_cache');
  if (cached) renderStats(cached.totalCheckins);

  // Always background-fetch for freshness
  try {
    const response = await fetch(`/.netlify/functions/practice-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (data.success) {
      const totalCheckins = data.practices.reduce((sum, p) => sum + (p.checkins || 0), 0);
      if (!cached || cached.totalCheckins !== totalCheckins) {
        renderStats(totalCheckins);
      }
      saveCache('obi_stats_cache', { totalCheckins });
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}
```

**Step 4 — Extract `renderChallenge(data)` function**. Take the display logic out of `loadChallenge()` into a named function. This function must:
- Set module-scoped `challengeData = data`
- Show `#march-challenge-block`
- Update `#challenge-streak-label`
- Clear `#home-calendar` innerHTML (important: prevents duplicate squares on re-render)
- Build the 31 calendar squares (same logic as current `loadChallenge()`)
- Call `selectDay(data.dayNumber)`

```javascript
function renderChallenge(data) {
  challengeData = data;
  document.getElementById('march-challenge-block').style.display = 'block';

  const s = data.streak;
  const streakEl = document.getElementById('challenge-streak-label');
  streakEl.textContent = s > 0 ? `🌞 ${s} day${s === 1 ? '' : 's'} streak` : 'No current streak';

  const calendar = document.getElementById('home-calendar');
  calendar.innerHTML = ''; // clear before rebuild

  for (let day = 1; day <= 31; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
    const isToday = day === data.dayNumber;
    const isComplete = data.completedDays.includes(dateStr);
    const isPartial = (data.partialDays || []).includes(dateStr);
    const isMissed = data.missedDays.includes(dateStr);
    const details = (data.dayDetails || {})[dateStr] || {};
    const partialSymbol = details.jogging ? '◐' : '◑';

    const sq = document.createElement('div');
    sq.dataset.day = day;
    sq.style.cssText = `
      width: 26px; height: 26px; border-radius: 3px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      background: ${isComplete ? '#4d9618' : isPartial ? '#9ab845' : isMissed ? '#f39c12' : isToday ? '#3498db' : '#f0f0f0'};
      color: ${isComplete || isPartial || isMissed || isToday ? '#fff' : '#ccc'};
    `;
    sq.textContent = isComplete ? '●' : isPartial ? partialSymbol : isMissed ? '○' : isToday ? '○' : '·';
    sq.addEventListener('click', () => selectDay(day));
    calendar.appendChild(sq);
  }

  selectDay(data.dayNumber);
}
```

**Step 5 — Rewrite `loadChallenge()`**:

```javascript
async function loadChallenge() {
  // Render from cache immediately (no flash)
  const cached = readCache('obi_challenge_cache');
  if (cached && cached.data && cached.data.dayNumber) {
    renderChallenge(cached.data);
  }

  // Always background-fetch for freshness
  try {
    const res = await fetch(`/api/challenge-status?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success && data.dayNumber) {
      if (challengeChanged(data, cached)) {
        renderChallenge(data);
      }
      saveCache('obi_challenge_cache', { data });
      localStorage.removeItem('obi_cache_dirty');
    }
  } catch (error) {
    console.error('Error loading challenge:', error);
  }
}
```

**The `selectDay()` function and event listeners remain unchanged.** The `loadStats()` and `loadChallenge()` calls at the bottom also stay as-is.

---

### File 2: `src/practice/log.njk`

**Location**: The form submit handler's success block (~line 342).

Find this line:
```javascript
if (data.success) {
  // Store practice ID and count for feedback and visualization
  currentPracticeId = data.practice.id;
```

Add one line immediately after `if (data.success) {`:
```javascript
localStorage.setItem('obi_cache_dirty', '1');
```

This signals to the homepage that a new practice was logged. The homepage background fetch will pick this up regardless (it always fetches), but the dirty flag is stored as an advisory. The `removeItem('obi_cache_dirty')` in `loadChallenge()` clears it after the fresh fetch.

---

### File 3: `src/practice/index.njk` — mobile top margin (small bonus fix)

The outer container div has `margin: 4rem auto` which is too much on mobile. In the existing `<style>` block (already in the file around line 40), add inside the `@media (max-width: 600px)` rule:

```css
div[style*="max-width: 800px"] {
  margin-top: 1rem !important;
}
```

---

## What NOT to Change

- Do not modify the HTML structure of `index.njk`
- Do not change `selectDay()` or the prev/next button event listeners
- Do not change any other files (no Netlify functions, no other pages)
- Do not add new files

---

## Verification Checklist

1. **First visit** (empty cache): page loads, shows loading state briefly, then stats + challenge render — same as before
2. **Second visit** (cache populated): stats + challenge render instantly with no flash; background fetch fires but doesn't change DOM (data unchanged)
3. **After logging a practice** on `/practice/log/`: navigate to `/practice/` — `obi_cache_dirty` is `'1'` in localStorage; background fetch fires, updates display if count changed
4. **Different device test** (or manually edit LS to have old data): visit `/practice/` — old data renders instantly, then background fetch updates DOM silently with new data
5. **Calendar re-render check**: when background fetch returns same data as cache, calendar is NOT rebuilt (no DOM flicker); only rebuilds when `challengeChanged()` returns true
6. **Mobile margin**: on a narrow viewport, the top margin of the homepage container is ~1rem, not 4rem
