# Ticket 5: Post-Practice Queue + Settings Toggle

## App Context
Dreamscape is a presence-based practice timer app (`apps/dreamscape`). Frontend: 11ty + Nunjucks, vanilla JS ES modules. Backend: Netlify Functions (Node.js CJS). Database: Firestore via `@habitualos/db-core`. AI: `@anthropic-ai/sdk`.

Auth is localStorage-based — `dp-signed-in`, `dp-userId` keys. `getUserId()` from `src/assets/js/auth/auth.js`.

**No `console.log`** — use `log()` from `src/assets/js/utils/log.js` (frontend) or `./_utils/log.cjs` (backend). No uppercase/all-caps.

**Depends on Tickets 3 + 4** — specifically:
- `/api/reflect-chat-save` endpoint (Ticket 3) must exist
- LS keys `reflect-chat-history`, `reflect-chat-timestamp`, `reflect-chat-saved` (set by Ticket 4's reflect.js)

---

## Phase 0: Explore First

Before implementing, read these files:
- `src/practice.njk` — full HTML structure of the practice page (especially the noteView section)
- `src/assets/js/pages/practice.js` — full JS module (timer, session management, save/discard flow)
- `src/assets/js/api.js` — `get(path)` and `post(path, body)` helpers
- `src/assets/js/auth/auth.js` — `getUserId()`, `isSignedIn()`
- `src/assets/js/collections/users.js` — `fetchProfile()` and `saveProfile()` — note that `saveProfile` calls `/api/user-register` which only handles `name` and `chime`
- `netlify/functions/user-profile-get.cjs` — what it currently returns
- `netlify/functions/collections/users.cjs` — `updateUser(userId, data)` which uses `patch`
- `src/settings.njk` — HTML structure of the settings page
- `src/assets/js/pages/settings.js` — how settings loads and saves profile data
- `netlify/functions/user-sessions.cjs` and `netlify/functions/collections/sessions.cjs` — session queries

After reading, check for reusable patterns. In particular, note that `saveProfile` in `users.js` currently only passes `{ name, chime }` — you'll need a new backend endpoint to save settings. Suggest the cleanest approach.

---

## Overview

This ticket adds:
1. **Post-practice AI reflection** — after every practice (save or skip), show a brief AI comment, then "continue →"
2. **Chimes-first queue architecture** — check for unread notes before showing AI comment (future chimes feature hooks in here)
3. **Auto-save Reflect chat** — when user arrives at /practice/, fire-and-forget any unsaved Reflect chat to Firestore
4. **Settings toggle** — user can turn off AI reflection in settings
5. **New backend endpoint** — `reflect-post-practice.cjs` (AI comment generator)
6. **New backend endpoint** — `user-settings-set.cjs` (saves user settings)

---

## File 1: `netlify/functions/reflect-post-practice.cjs` (NEW)

**Endpoint:** POST `/api/reflect-post-practice`
**Input:** `{ userId, practiceName, durationSeconds, note, timezone }`
**Output:** `{ comment }`

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const { getUser } = require('./collections/users.cjs');
const { getSessionsForUser } = require('./collections/sessions.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.post-practice', 'POST', async (event, {
  userId, practiceName, durationSeconds, note, timezone = 'America/Los_Angeles'
}) => {
  if (!userId) throw new Error('userId required');
  if (!practiceName) throw new Error('practiceName required');

  const [user, sessions] = await Promise.all([
    getUser(userId),
    getSessionsForUser(userId),
  ]);

  const name = user?._name || 'you';

  // Count prior sessions of THIS specific practice type
  // (the session just completed may or may not be in the list yet)
  const priorSessions = (sessions || []).filter(s =>
    s.practiceName && s.practiceName.toLowerCase() === practiceName.toLowerCase()
  );
  const sessionCount = priorSessions.length; // N prior (so this was session N+1, or "Nth+1")

  const durationMins = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;

  // Format local time
  const localTimeStr = new Date().toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    hour12: true,
  });

  // Human-readable session count
  const n = sessionCount + 1; // this session
  const countPhrase = n === 1 ? 'their first session'
    : n === 2 ? 'their 2nd session'
    : n === 3 ? 'their 3rd session'
    : `their ${n}th session`;

  const userContent = [
    `You witnessed ${name} complete ${durationMins ? `${durationMins} minute${durationMins !== 1 ? 's' : ''} of ` : ''}${practiceName}.`,
    `This is ${countPhrase} of ${practiceName}.`,
    `Local time: ${localTimeStr}.`,
    note?.trim() ? `They wrote: "${note.trim()}"` : null,
    '',
    'Respond in 1-2 sentences. Calm, observant, present-tense. Reference their note if present and relevant. Reference the session count only if it feels meaningful (first time, a milestone). No cheerleading.',
  ].filter(Boolean).join('\n');

  const client = new Anthropic.default();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: 'You are a calm, grounded witness. Present-tense. Brief and unhurried.',
    messages: [{ role: 'user', content: userContent }],
  });

  const comment = response.content?.[0]?.text?.trim() || '';
  log('debug', '[reflect-post-practice] comment for', userId, practiceName, 'session', n);

  return { comment };
});
```

---

## File 2: `netlify/functions/user-settings-set.cjs` (NEW)

A dedicated endpoint for saving user settings, separate from user-register (which only handles name/chime). This keeps settings atomic and avoids overwriting name/chime accidentally.

**Endpoint:** POST `/api/user-settings-set`
**Input:** `{ userId, settings }` — `settings` is a partial object (e.g., `{ reflectAfterPractice: false }`)
**Output:** `{ ok: true }`

```javascript
const { updateUser } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('user.settings.set', 'POST', async (event, { userId, settings }) => {
  if (!userId) throw new Error('userId required');
  if (!settings || typeof settings !== 'object') throw new Error('settings object required');

  // Prefix all keys with 'settings.' for Firestore dot-notation patch
  const patch = {};
  for (const [key, value] of Object.entries(settings)) {
    patch[`settings.${key}`] = value;
  }

  await updateUser(userId, patch);
  log('debug', '[user-settings-set] userId:', userId, 'patch:', patch);

  return { ok: true };
});
```

Note: `updateUser` uses `patch` from `@habitualos/db-core` which supports Firestore dot-notation field paths. `settings.reflectAfterPractice` will correctly update just that nested field.

---

## File 3: `netlify/functions/user-profile-get.cjs` (MODIFY)

Currently returns `{ name, email, chime }`. Add `settings`:

```javascript
// Change the return statement:
return {
  name:     user._name  || '',
  email:    user._email || '',
  chime:    user.chime  || null,
  settings: user.settings || {},
};
```

---

## File 4: `src/assets/js/collections/users.js` (MODIFY)

Currently:
```javascript
export function fetchProfile() { return get(`/api/user-profile-get?userId=...`); }
export function saveProfile({ name, chime } = {}) { return post('/api/user-register', { userId, name, chime }); }
```

Add a new `saveSettings` function:
```javascript
export function saveSettings(settings) {
  return post('/api/user-settings-set', { userId: getUserId(), settings });
}
```

---

## File 5: `src/practice.njk` (MODIFY)

Read the full file first. Find the `noteView` section — it currently has a textarea and a save button.

**Add to the noteView section, after the existing save button:**
```html
<button id="skip-reflection-btn" class="note-skip-btn">Skip</button>

<div id="practice-comment" hidden>
  <p id="practice-comment-text" class="practice-comment-text"></p>
  <a href="/" id="continue-link" class="continue-link">continue →</a>
</div>
```

**Styles to add to `src/styles/_components.scss`:**
```scss
// ─── Post-practice reflection (in practice noteView)
.note-skip-btn {
  display: block;
  background: none;
  border: none;
  color: $color-text-muted;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0.25rem 0;
  margin-top: 0.4rem;
  opacity: 0.5;

  &:hover { opacity: 0.8; }
}

.practice-comment-text {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: $color-text;
  line-height: 1.65;
  margin: 1.75rem 0 0.75rem;
}

.continue-link {
  display: inline-block;
  font-size: 0.85rem;
  color: $color-text-muted;
  text-decoration: none;
  opacity: 0.55;

  &:hover { opacity: 0.85; }
}
```

---

## File 6: `src/assets/js/pages/practice.js` (MODIFY)

Read the full file first. Then make these changes:

### A. Add imports at top
```javascript
import { get, post } from '../api.js';
import { getUserId } from '../auth/auth.js';
import { log } from '../utils/log.js';
```
(Check if any of these are already imported — don't duplicate.)

### B. Add module-level state vars (after existing `let` declarations)
```javascript
let _currentPracticeName = '';
let _currentDurationSeconds = 0;
let _currentNote = '';
```

### C. Auto-save pending Reflect chat on page load

Add this immediately after the element query variables (before event listeners):
```javascript
// Auto-save any pending Reflect chat from localStorage (set by /reflect/)
(function savePendingReflectChat() {
  try {
    const userId = getUserId();
    const history = localStorage.getItem('reflect-chat-history');
    const saved = localStorage.getItem('reflect-chat-saved');
    if (history && saved !== 'true' && userId) {
      const messages = JSON.parse(history);
      if (messages.length > 0) {
        post('/api/reflect-chat-save', { userId, messages }).catch(() => {});
        localStorage.setItem('reflect-chat-saved', 'true');
      }
    }
  } catch {}
})();
```

### D. Capture practice type in `begin()` and duration in `stopSession()`

In `begin()`, add:
```javascript
_currentPracticeName = nameInput.value.trim();
```

In `stopSession()`, capture duration:
```javascript
_currentDurationSeconds = totalSeconds - remainingSeconds;
```

### E. Replace `save()` function

Current `save()`:
```javascript
async function save() {
  saveBtn.disabled = true;
  await saveReflection(noteInput.value.trim());
  window.location.href = '/';
}
```

New `save()`:
```javascript
async function save() {
  saveBtn.disabled = true;
  _currentNote = noteInput.value.trim();
  await saveReflection(_currentNote);
  await loadPostPracticeQueue();
}
```

### F. Add skip button handler

```javascript
document.getElementById('skip-reflection-btn').addEventListener('click', async () => {
  _currentNote = '';
  await loadPostPracticeQueue();
});
```

### G. Add `loadPostPracticeQueue()` function

```javascript
async function loadPostPracticeQueue() {
  const userId = getUserId();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 1. Check for unread chimes (notes unlocked after practice)
  // If chimes exist, they take precedence over AI reflection.
  // Voice chime display is not yet implemented — this is the architecture hook.
  try {
    const unread = await get(`/api/unread-check?userId=${encodeURIComponent(userId)}`);
    if (unread && unread.count > 0) {
      // TODO (future ticket): show chime display UI here (one chime per screen)
      // For now, fall through to AI reflection
    }
  } catch {}

  // 2. Check user setting (default: show reflection)
  let reflectEnabled = true;
  try {
    const profile = await get(`/api/user-profile-get?userId=${encodeURIComponent(userId)}`);
    reflectEnabled = profile?.settings?.reflectAfterPractice !== false;
  } catch {}

  if (!reflectEnabled) {
    window.location.href = '/';
    return;
  }

  // 3. Show AI comment
  const commentEl = document.getElementById('practice-comment');
  const commentText = document.getElementById('practice-comment-text');
  const continueLink = document.getElementById('continue-link');

  commentEl.hidden = false;
  commentText.textContent = '…';
  continueLink.hidden = true;

  try {
    const result = await post('/api/reflect-post-practice', {
      userId,
      practiceName: _currentPracticeName,
      durationSeconds: _currentDurationSeconds,
      note: _currentNote || null,
      timezone,
    });

    if (result.comment) {
      commentText.textContent = result.comment;
      continueLink.hidden = false;
    } else {
      window.location.href = '/';
    }
  } catch (err) {
    log('warn', '[practice] post-practice reflection failed:', err.message);
    window.location.href = '/';
  }
}
```

---

## File 7: `src/settings.njk` (MODIFY)

Read the full file first. Find `id="step-settings"` div. Inside it, after the chime/name settings, before the save button, add:

```html
<div class="settings-row" id="settings-reflect-row">
  <span class="settings-label">AI reflection after practice</span>
  <button class="settings-value" id="settings-reflect-value">on</button>
</div>
```

Check existing settings HTML for the correct `.settings-row` / `.settings-label` / `.settings-value` class names — use whatever pattern is already in the file.

---

## File 8: `src/assets/js/pages/settings.js` (MODIFY)

Read the full file first. Make two additions:

### A. Import `saveSettings`
Add to imports at top:
```javascript
import { fetchProfile, saveProfile, saveSettings } from '../collections/users.js';
```
(Only add `saveSettings` — `fetchProfile` and `saveProfile` likely already imported.)

### B. Handle the reflect toggle in the init block

Find where the profile is loaded (the `(async () => { ... })()` block). After the existing profile fields are set, add:

```javascript
// Reflect setting
const reflectBtn = document.getElementById('settings-reflect-value');
if (reflectBtn) {
  let reflectEnabled = profile.settings?.reflectAfterPractice !== false; // default: true
  reflectBtn.textContent = reflectEnabled ? 'on' : 'off';

  reflectBtn.addEventListener('click', async () => {
    reflectEnabled = !reflectEnabled;
    reflectBtn.textContent = reflectEnabled ? 'on' : 'off';
    markDirty();
  });
}
```

### C. Include settings in save()

Find the existing `save()` function. After `saveProfile({ name, chime: _pendingChime })`, also save settings:

```javascript
async function save() {
  // ... existing validation ...
  const reflectBtn = document.getElementById('settings-reflect-value');
  const reflectEnabled = reflectBtn ? reflectBtn.textContent === 'on' : true;

  await Promise.all([
    saveProfile({ name: currentName(), chime: _pendingChime }),
    saveSettings({ reflectAfterPractice: reflectEnabled }),
  ]);

  // ... existing markSaved() / success logic ...
}
```

Adapt to match the existing save() structure exactly — don't change the error handling or button state logic, just add the parallel saveSettings call.

---

## Verification

1. **Auto-save Reflect chat:** Do a Reflect session → navigate to `/practice/` → check Firestore `reflect-chats` collection → document created, `reflect-chat-saved` LS key is `'true'`

2. **Post-practice AI comment (with note):** Complete practice → enter note → Save → "…" loading, then AI comment appears → "continue →" visible, click goes home

3. **Post-practice AI comment (skip):** Complete practice → click Skip → same AI comment flow appears

4. **Post-practice AI comment (empty note):** Skip still shows AI comment (the note is null but the endpoint handles that)

5. **Comment accuracy:** Comment correctly references the Nth session of that specific practice (not total all-practices). Check the `priorSessions` count in the backend matches what you expect.

6. **Local time:** Comment does not reference wrong timezone. Check by manually testing with a different timezone string.

7. **Settings toggle — off:** Toggle AI reflection to "off" in settings → save → complete practice → skip or save → immediately redirected home, no AI comment

8. **Settings toggle — on (default):** New users or toggle back to "on" → AI comment shows

9. **Chimes-first hook:** Verify the queue function checks `/api/unread-check`. With 0 unread notes, falls through to AI comment. (Full chime display is future — just verify the branch exists in code.)

10. **Reflect-pill + nav (from Ticket 1):** If Ticket 1 is complete, verify the nav Reflect link and homepage reflect-pill still work after your changes.
