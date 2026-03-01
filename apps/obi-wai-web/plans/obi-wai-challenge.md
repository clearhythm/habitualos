# Obi-Wai March 2026 Challenge + SMS Integration

## Overview

This plan adds two major capabilities to `apps/obi-wai-web`:

1. **March 2026 30-day challenge tracking** — visual goal progress (jogging + LASSO daily) on the home page
2. **Twilio SMS integration** — inbound practice logging + coaching via text, plus a daily 7pm PT reminder if goals aren't checked in

This enables using Obi-Wai's full coaching loop over SMS, starting March 1, 2026.

---

## App Context

**Location:** `apps/obi-wai-web/` (standalone Netlify app, monorepo root `habitualos`)

**Tech stack:**
- Frontend: 11ty + Nunjucks templates, vanilla JS, SCSS
- Backend: Netlify serverless functions (Node.js, `netlify/functions/`)
- DB: Firestore via `@habitualos/db-core` and `@habitualos/auth-server`
- AI: Anthropic SDK (`claude-sonnet-4-5`)
- Deploy: Netlify (git push deploys)

**Existing service pattern:**
- Services in `netlify/functions/_services/*.cjs`
- Uses `dbCore.query()`, `dbCore.create()`, `dbCore.patch()` from `@habitualos/db-core`
- The `users` Firestore collection is managed by `@habitualos/auth-server`'s `db-users.cjs` (`updateUser`, `getUserById`)

**Key existing functions:**
- `practice-submit.js` — logs a practice + generates AI wisdom
- `practice-list.js` — returns practice library
- `practice-logs-list.js` — returns timeline
- `practice-chat.js` — coaching conversation (non-streaming)

**Existing Firestore collections:**
- `practice-logs` — individual log entries (`_userId`, `practice_name`, `duration`, `reflection`, etc.)
- `practices` — unique practices per user
- `users` — user accounts (`_userId`, `_email`); phone number will be added here

**Auth model:** Anonymous guest users with `u-{timestamp}-{random}` IDs stored in client localStorage. When user registers via email sign-in, a `users` doc is created. For anonymous users, `updateUser()` (which uses `set` + `merge:true`) will create the doc if missing.

**Existing env vars:** `ANTHROPIC_API_KEY`, `FIREBASE_ADMIN_CREDENTIALS`, `RESEND_API_KEY`

---

## New Environment Variables Needed

Add to `.env` (local) and Netlify dashboard (production):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

---

## Pre-Requisite: Twilio Setup (manual, ~15 min)

1. Create account at [twilio.com](https://twilio.com)
2. Get a phone number with SMS enabled (trial works)
3. Note your Account SID, Auth Token, and phone number
4. After deploying the `sms-inbound` function, set the webhook URL in Twilio Console:
   - Phone Number → Messaging → "A message comes in" → Webhook → `https://YOUR_SITE.netlify.app/api/sms-inbound`
   - Method: HTTP POST

---

## March Challenge Logic

- **Challenge period:** March 1–31, 2026
- **Daily goals:** log "Jogging" + log "LASSO" (both, any duration)
- **Completion:** A calendar day (Pacific time) is complete when at least one log with `practice_name` matching `/jog|run/i` AND one matching `/lasso|meditat/i` exist for that date
- **Honor system:** no minimum duration enforced
- **Streak:** consecutive complete days (counting backwards from the most recent complete day)

---

## Files to Create

### 1. `netlify/functions/_services/db-user-profiles.cjs`

App-local service for phone-number operations on the `users` collection.

```javascript
// netlify/functions/_services/db-user-profiles.cjs
require('dotenv').config();
const dbCore = require('@habitualos/db-core');
const { updateUser } = require('@habitualos/auth-server');

// Look up a user by phone number
async function getUserByPhone(phoneNumber) {
  const results = await dbCore.query({
    collection: 'users',
    where: `phoneNumber::eq::${phoneNumber}`
  });
  return results.length > 0 ? results[0] : null;
}

// Save phone number to user's profile (creates user doc if needed)
async function setUserPhone(userId, phoneNumber) {
  await updateUser(userId, { phoneNumber });
  return true;
}

// Get all users who have a phone number registered
async function getAllUsersWithPhone() {
  const results = await dbCore.query({
    collection: 'users',
    where: 'phoneNumber::exists::true'
  });
  return results;
}

module.exports = { getUserByPhone, setUserPhone, getAllUsersWithPhone };
```

**Note:** The `dbCore.query()` where-clause syntax follows the pattern used in `db-practice-logs.cjs`. If `@habitualos/db-core` doesn't support `exists` operator, use a fallback: fetch all users and filter in JS for `getAllUsersWithPhone`. Verify the actual query syntax against `@habitualos/db-core`.

### 2. `netlify/functions/user-profile-set.js`

```javascript
/**
 * POST /api/user-profile-set
 *
 * Save the user's phone number for SMS reminders.
 * Body: { userId, phoneNumber }
 * Returns: { success: true }
 */
```

- Validate `userId` starts with `u-`
- Normalize phone to E.164 format (strip non-digits, prepend `+1` if 10 digits)
- Call `setUserPhone(userId, phoneNumber)`
- Return `{ success: true }`

### 3. `netlify/functions/challenge-status.js`

```javascript
/**
 * GET /api/challenge-status?userId=u-...
 *
 * Returns March 2026 challenge progress for the user.
 * Returns: {
 *   success: true,
 *   completedDays: ["2026-03-01", ...],   // Pacific date strings (YYYY-MM-DD)
 *   missedDays: [...],                     // past days that weren't complete
 *   todayJogging: bool,
 *   todayLasso: bool,
 *   todayComplete: bool,
 *   streak: N,
 *   dayNumber: N    // 1–31 (which day of March we're on)
 * }
 */
```

Implementation:
1. Fetch all practice logs for userId via `getPracticeLogsByUserId(userId)` (existing service)
2. Filter to March 2026 (UTC timestamps, convert to Pacific for date grouping)
3. Group by Pacific date
4. For each date: check `practice_name` for jogging match + LASSO match
5. Calculate streak (count backwards from today or last complete day)
6. Return structured result

Pacific time conversion: use `toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })` to get date string, then parse `MM/DD/YYYY` → `YYYY-MM-DD`.

### 4. `netlify/functions/sms-inbound.js`

```javascript
/**
 * POST /api/sms-inbound
 *
 * Twilio webhook for incoming SMS messages.
 * Handles: practice logging and Obi-Wai coaching conversations.
 */
```

Flow:
1. Parse Twilio POST body (URL-encoded): `From`, `Body`
2. Validate Twilio signature using `twilio.validateRequest()` (skip in local dev: `APP_ENV=local`)
3. Look up userId via `getUserByPhone(From)` — if none found, reply with registration URL
4. Detect intent from `Body`:
   - Contains `/jog|run|jogging|running|ran/i` → practice = "Jogging"
   - Contains `/lasso|meditat|mindful/i` → practice = "LASSO"
   - Optional duration: parse `(\d+)\s*(?:min|mins|minutes)` from message
   - If practice detected → log it + build confirmation reply
   - If no practice detected → call Claude for coaching reply
5. For **logging path**:
   - Call `createPracticeLog()` with userId, practice_name, duration
   - Fetch updated challenge status
   - Build reply: `"{Practice} logged{duration}.\n{Obi-Wai 1-liner}\nToday: Jogging {✓/○} · LASSO {✓/○} (Day N/31)"`
6. For **coaching path**:
   - Call Claude with compact SMS Obi-Wai system prompt (see below)
   - 3 sentences max response
7. Return TwiML: `Content-Type: text/xml`, body: `<Response><Message>{text}</Message></Response>`

**SMS Obi-Wai system prompt (coaching path):**
```
You are Obi-Wai, a calm, understated habit companion. The person is doing a 30-day challenge:
daily jogging (5+ min) and LASSO mindfulness meditation (5+ min). They've texted you instead
of checking in — there may be a block or they need encouragement.

Respond in 2–3 sentences. Your voice: direct, observational, no cheerleading, no exclamation marks.
Key message: consistency matters more than duration. The smallest unit of practice is worth it.
Help them dissolve any block by reframing perfectionism. Gently prompt them to reply with what
they did to log it.
```

**Twilio signature validation:**
```javascript
const twilio = require('twilio');
const valid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN,
  signature,
  url,
  params
);
```
Skip validation when `APP_ENV === 'local'`.

### 5. `netlify/functions/sms-reminder.js` (scheduled)

```javascript
/**
 * Scheduled daily reminder at 7pm PT.
 * Cron: "0 2 * * *" UTC = 7pm PDT (Mar 8–31) / 6pm PST (Mar 1–7)
 *
 * Sends SMS to users who haven't completed both goals today.
 */
```

Flow:
1. Get all users with phone: `getAllUsersWithPhone()`
2. For each user: run challenge-status logic inline (or call helper function)
3. If `todayComplete` → skip (don't spam)
4. Build message based on partial completion:
   - Neither: `"Day X of 31. Still time today.\n5 min jogging + 5 min LASSO. That's the whole practice."`
   - Jogging only: `"Jogging done. LASSO still waiting.\n5 minutes is all it takes."`
   - LASSO only: `"LASSO done. Still time for a jog.\nEven 5 minutes counts."`
5. Send via Twilio REST client: `client.messages.create({ to, from, body })`

---

## Files to Modify

### 6. `package.json`

Add to `dependencies`:
```json
"twilio": "^5.0.0"
```

Then run: `pnpm install` from monorepo root.

### 7. `netlify.toml`

Add after the existing `[functions."practice-submit"]` block:
```toml
[functions."sms-inbound"]
  timeout = 26

[functions."sms-reminder"]
  schedule = "0 2 * * *"
```

### 8. `src/practice/index.njk`

Add a March Challenge block **above** the existing action cards grid. Loads challenge-status on page init.

**HTML structure to insert:**
```html
<!-- March Challenge Block -->
<div id="challenge-block" style="margin: 2rem 0 3rem; padding: 1.5rem; border: 2px solid #e8e8e8; border-radius: 12px; text-align: left; display: none;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <strong>🐉 March Daily Challenge</strong>
    <span id="challenge-day" style="color: #666; font-size: 0.9rem;"></span>
  </div>

  <div style="margin-bottom: 1rem;">
    <div style="margin-bottom: 0.5rem;">
      <span id="goal-jogging">🏃 Jogging</span>
      <span id="goal-jogging-status" style="margin-left: 0.5rem; color: #999;">○ not yet</span>
    </div>
    <div>
      <span id="goal-lasso">🧘 LASSO</span>
      <span id="goal-lasso-status" style="margin-left: 0.5rem; color: #999;">○ not yet</span>
    </div>
  </div>

  <div style="margin-bottom: 1rem; font-size: 0.9rem; color: #666;">
    Streak: <span id="challenge-streak">0</span> days
  </div>

  <!-- Calendar grid: 31 squares -->
  <div id="challenge-calendar" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 1rem;"></div>
</div>
```

**JS block to add (inside the existing `<script type="module">`):**
```javascript
async function loadChallenge(userId) {
  const response = await fetch(`/api/challenge-status?userId=${userId}&_=${Date.now()}`, {
    cache: 'no-store'
  });
  const data = await response.json();
  if (!data.success) return;

  const block = document.getElementById('challenge-block');
  block.style.display = 'block';

  // Day indicator
  document.getElementById('challenge-day').textContent = `Day ${data.dayNumber} / 31`;

  // Today's goals
  const jogStatus = document.getElementById('goal-jogging-status');
  jogStatus.textContent = data.todayJogging ? '✓ done' : '○ not yet';
  jogStatus.style.color = data.todayJogging ? '#27ae60' : '#999';

  const lassoStatus = document.getElementById('goal-lasso-status');
  lassoStatus.textContent = data.todayLasso ? '✓ done' : '○ not yet';
  lassoStatus.style.color = data.todayLasso ? '#27ae60' : '#999';

  // Streak
  document.getElementById('challenge-streak').textContent = data.streak;

  // Calendar grid
  const calendar = document.getElementById('challenge-calendar');
  calendar.innerHTML = '';
  for (let day = 1; day <= 31; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
    const isToday = day === data.dayNumber;
    const isPast = day < data.dayNumber;
    const isComplete = data.completedDays.includes(dateStr);
    const isMissed = data.missedDays.includes(dateStr);

    const square = document.createElement('div');
    square.title = dateStr;
    square.style.cssText = `
      width: 20px; height: 20px; border-radius: 3px; font-size: 10px;
      display: flex; align-items: center; justify-content: center;
      background: ${isComplete ? '#27ae60' : isMissed ? '#e74c3c' : isToday ? '#3498db' : '#f0f0f0'};
      color: ${isComplete || isMissed || isToday ? '#fff' : '#ccc'};
    `;
    square.textContent = isComplete ? '●' : isMissed ? '✗' : isToday ? '○' : '·';
    calendar.appendChild(square);
  }
}

// Call in loadStats or separately
loadChallenge(userId);
```

### 9. `src/_includes/nav.njk`

Add Profile link to the secondary nav list (after the existing Library link):
```html
<li><a href="/profile/">Profile</a></li>
```

---

## Files to Create (Frontend)

### 10. `src/profile.njk` (route: `/profile/`)

```
---
title: Profile - HabitualOS
layout: base.njk
permalink: /profile/
---
```

Page content:
- Brief intro: "Register your phone number so Obi-Wai can text you a reminder at 7pm if you haven't checked in."
- Phone input form (pre-filled if already set)
- Submit → `POST /api/user-profile-set`
- Status message on success/error
- Loads current phone from `GET /api/users?docId={userId}` (existing endpoint)

JS: normalize phone to E.164 before submitting (strip non-digits, prepend `+1` if 10 digits).

---

## Implementation Order

Do these in sequence:

1. **`package.json`** — add `"twilio": "^5.0.0"` → run `pnpm install` from monorepo root
2. **`netlify/functions/_services/db-user-profiles.cjs`** — service layer
3. **`netlify/functions/user-profile-set.js`** — phone registration endpoint
4. **`src/profile.njk`** + nav link in `src/_includes/nav.njk`
5. **`netlify/functions/challenge-status.js`** — challenge logic endpoint
6. **`src/practice/index.njk`** — add challenge display block
7. **`netlify/functions/sms-inbound.js`** — Twilio webhook handler
8. **`netlify/functions/sms-reminder.js`** — scheduled reminder
9. **`netlify.toml`** — add scheduled function config + SMS timeout
10. **`.env` + Netlify dashboard** — add Twilio env vars
11. **Deploy** → set Twilio webhook URL → test

---

## SMS UX Reference

**Practice logged ("jogged 10 min"):**
```
Jogging logged — 10 minutes.
I'm watching what you're building here.
Today: Jogging ✓ · LASSO ○  (Day 1/31)
```

**Both done ("jogged and did LASSO for 7 min"):**
```
Jogging + LASSO logged. Day 1 complete.
That's the practice.
```

**Coaching ("not feeling it"):**
```
[Obi-Wai: 2-3 sentences in character — understated, observational, no exclamation marks]
Smallest unit counts. Reply with what you did to log it.
```

**7pm reminder (neither done, Day 5):**
```
Day 5 of 31. Still time today.
5 min jogging + 5 min LASSO. That's the whole practice.
```

**Jogging only done:**
```
Jogging done. LASSO still waiting.
5 minutes is all it takes.
```

**Unknown phone:**
```
I don't recognize this number. Register at: [URL]/profile/
```

---

## Verification Checklist

- [ ] Register phone at `/profile/` → confirm saved
- [ ] Text Twilio number "jogged 10 min" → get confirmation + today's status
- [ ] Text "not feeling it today" → get Obi-Wai coaching response
- [ ] Text "lasso 6 min" → LASSO logged, Day complete message
- [ ] Check `/practice/` home page — March calendar shows today's status with correct colors
- [ ] Invoke `sms-reminder` function manually (or wait for 7pm PT) → SMS received only if not complete
- [ ] After completing both goals, invoke reminder → no SMS sent

---

## Known Limitations (V1)

- No SMS conversation threading (each text is fresh context, no history)
- No phone number verification (OTP) — trust-based
- Hardcoded March 2026 challenge dates and goal practices
- Cron fires at 2am UTC = 7pm PDT (Mar 8–31) or 6pm PST (Mar 1–7)
- Single SMS per reminder trigger (no retry if delivery fails)
