# TICKET: Signal Network — Test Account + Outreach Guard + LinkedIn URL Normalization

## Context

Three issues surfaced during API test runs against the network endpoints:

1. **Tests write to real Firestore data** — running `api.test.js` with a real `userId` creates real contacts under the owner's account (currently Erik's).
2. **Real people get emailed** — the outreach endpoint fires for contacts scoring ≥8. No guard prevents this from running in test/demo contexts.
3. **Duplicate contacts** — `upsertContactByLinkedIn` dedupes on exact `linkedinUrl` string. Slight URL variations (trailing slash, capitalization) produce separate docs for the same person. Currently 3 Adam Grant entries in Firestore.

## Tasks

### 1. Normalize LinkedIn URLs in `db-signal-contacts.cjs`

In `upsertContactByLinkedIn`, normalize the LinkedIn URL before querying and before writing:

```js
function normalizeLinkedIn(url) {
  if (!url) return null;
  return url.replace(/\/$/, '').toLowerCase().trim();
}
```

Apply on both the query side and the stored value.

### 2. Add `outreachEnabled` flag to owner schema

- Add `outreachEnabled: boolean` to signal-owners docs (default `true` for real owners)
- In `signal-network-outreach.js`, check `owner.outreachEnabled !== false` before sending email
- This is a general-purpose pause switch, not just for testing

### 3. Create a demo/test owner account

Add `scripts/demo/seed-demo-owner.cjs` — seeds a `signal-owners` doc with:
- A known `_userId` (e.g. `u-demo-signal-test`)
- `status: 'active'`
- `outreachEnabled: false`
- Enough profile data for scoring to work (skills, background)
- No real Anthropic key — falls back to `ANTHROPIC_API_KEY` env var

### 4. Update `tests/api.test.js` to use demo account

- Change owner-auth tests to use `SIGNAL_USER_ID=u-demo-signal-test` (or env override)
- Update CLAUDE.md test instructions to reference the demo userId
- Add a post-run cleanup step that deletes contacts created with `source: 'test'`

## How to run

```
# Seed the demo owner (one-time)
node scripts/demo/seed-demo-owner.cjs

# Run tests against demo account
SIGNAL_USER_ID=u-demo-signal-test node tests/api.test.js
```

## Notes

- The 3 duplicate Adam Grant docs in production Firestore should be manually cleaned up after the URL normalization fix ships (keep the most complete one, delete the others)
- `outreachEnabled` flag is the right long-term pattern — owners may want to pause outreach without disabling their account
