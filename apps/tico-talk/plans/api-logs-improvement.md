# API layer follow-up: all data I/O through api.js + adopt request logging

## App Context

Debts noted while building the /menu/ client-fetched-menu work (see
`restaurant-menus.js`, the first real consumer of `api.js` in this app).
Not urgent, deliberately deferred — capturing so they aren't lost.

**Guiding principle (Erik, direct instruction): all data CRUD should go
through the api route + tracking layer.** Not just a style-consistency
thing — routing every request through one client-side chokepoint
(`api.js`) is what makes it possible to add request tracking/telemetry
(timing, correlation IDs, retry, offline queueing, whatever's needed
later) in one place instead of at every call site. Raw `fetch()` calls
scattered around the codebase can't benefit from that later without
individually being found and rewritten — so the real goal of this ticket
is zero raw `fetch()` calls left outside `api.js` itself.

## 1. Retrofit every existing raw-`fetch()` call site onto `api.js`

`src/assets/js/api.js` (thin `get`/`post` fetch wrappers) exists already;
`collections/restaurant-menus.js` is the only current consumer. Found via
`grep -rl "fetch(" src/assets/js/` (excluding `api.js` itself):

- **`collections/learn-chats.js`** — `saveLearnChatBeacon`, `saveLearnChat`,
  `getLearnChat` all use raw `fetch`. `saveLearnChatBeacon` specifically
  uses `navigator.sendBeacon`, not `fetch` — it can't route through
  `api.js`'s `post()` as-is; either leave it as the one documented
  exception, or extend `api.js` with a `postBeacon` helper if sendBeacon
  usage shows up elsewhere too.
- **`restaurant.js`** — `resolveInitialRestaurantId` (GET
  `/api/user-restaurant-get`) and `saveLastRestaurant` (POST
  `/api/user-restaurant-set`) use raw `fetch` directly in a non-collection
  file. These are really "users" collection concerns (a user's restaurant
  preference) — worth a `collections/users.js` rather than just swapping
  `fetch` for `get`/`post` in place.
- **`menu-restaurant-filter.js`** — the flag-and-confirm correction flow
  (`proposeCorrection`'s POST to `/api/learn-propose-correction`, and the
  confirm handler's POST to `/api/learn-save-correction`) uses raw `fetch`
  inline in the page script, not factored into a collection file at all.
  These are `restaurant-notes` concerns — worth a
  `collections/restaurant-notes.js`.

## 2. Adopt a request-logging pattern like dreamscape's `api-logs`

`apps/dreamscape/netlify/functions/_utils/api.cjs` +
`admin-logs.cjs` — dreamscape wraps its Netlify function handlers to log
each request (endpoint, params, timing, outcome) to an `api-logs`
Firestore collection, with an admin endpoint to review them. tico-talk
has no equivalent today — Netlify function logs only exist in Netlify's
own function log viewer, not queryable/reviewable in-app.

Worth adopting for two reasons Erik flagged directly: it's a real
debugging aid (see how the app is actually being used/failing without
digging through Netlify's dashboard), and it adds a lightweight security
audit trail (who called what, when) that doesn't exist right now.

Scope this as its own investigation — read `_utils/api.cjs` and
`admin-logs.cjs` fully first to understand what dreamscape actually
captures and how the admin view works, then decide what's worth porting
vs. what's dreamscape-specific (auth/admin-role checks in particular will
differ, since tico-talk doesn't have dreamscape's user/role model).
