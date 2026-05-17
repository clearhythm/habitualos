# Daily Practice Admin

Static admin dashboard for `daily.habitualos.com`. Deployed as a **separate Netlify site** at `admin.habitualos.com`, protected by Cloudflare Zero Trust.

## Architecture

- **Frontend**: Plain HTML/CSS/JS (no build step)
- **Functions**: Shared with the main app (`../netlify/functions/`)
- **Auth**: `ADMIN_SECRET` env var set only on the admin Netlify site. All requests send `X-Admin-Key` header. Functions return 403 if header doesn't match.

## Netlify site config (admin site)

| Setting | Value |
|---|---|
| Base directory | `apps/dreamscape` |
| Publish directory | `admin` |
| Functions directory | `netlify/functions` |
| Build command | *(none)* |

Set `ADMIN_SECRET` in the admin site's Netlify environment variables. Do NOT set it on the main site.

## Local dev

Point `js/api.js` BASE_URL at `http://localhost:8888` (already the default for localhost).
Set `ADMIN_SECRET` in `apps/dreamscape/.env` and enter the same value in the admin key field.

## Sections

**Activity** — Circle members, recent sessions. Calls `admin-circle` and `admin-sessions` functions.

**Testing** — Seed 4 test scenarios for the circle notes feature. Calls `admin-seed` (POST) and `admin-reset` (POST).

### Test users

| ID | Name | Role |
|---|---|---|
| `u-test-erik` | Erik | Note recipient (simulates "you") |
| `u-test-sarah` | Sarah | Circle member, note sender |
| `u-test-frank` | Frank | Circle member, no notes |
| `u-test-roi` | Ro'i | Circle member, note sender |

### Scenarios

| Scenario | State |
|---|---|
| `no-notes` | Alice is in circle, no notes exist |
| `notes-waiting` | Bob sent Alice a note; Alice hasn't practiced today (locked) |
| `notes-unlocked` | Bob sent Alice a note; Alice practiced today (unlocked) |
| `all-caught-up` | Alice has read all notes |

## Adding admin endpoints

1. Create `../netlify/functions/admin-{name}.cjs`
2. Check `req.headers['x-admin-key'] === process.env.ADMIN_SECRET` — return 403 if not
3. Add `AdminAPI.{method}` to `js/api.js`
