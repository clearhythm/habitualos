# Kirk vs Data: Head-to-Head Demo Page

## Context

The Signal app has a working `/spock-vs-data` demo page that evaluates two Star Trek characters against six job roles using the Signal behavioral scoring system. We're building a second demo, `/kirk-vs-data`, to support a Substack article: *AI vs. Human: Who's the Better Hire?* Kirk represents intuition/humanity; Data represents AI/logic. The seven roles are chosen to produce a narrative arc with surprising wins and losses.

This work also abstracts the page system so future head-to-head demos are turnkey — even between real Signal users.

---

## Files to Create / Modify

| Action | File |
|--------|------|
| CREATE | `src/_includes/head-to-head-demo.css.njk` |
| CREATE | `src/_includes/head-to-head-demo.js.njk` |
| MODIFY | `src/landing-pages/spock-vs-data.njk` — refactor to thin wrapper |
| CREATE | `src/landing-pages/kirk-vs-data.njk` |
| MODIFY | `netlify/functions/signal-demo-evals-get.js` |
| CREATE | `scripts/demo/seed-kirk-data.cjs` |
| CREATE | `scripts/demo/precompute-kirk-data.cjs` |
| CREATE | `scripts/demo/migrate-demo-eval-demoIds.cjs` |
| PLACE  | `src/assets/images/kirk.jpg` — local static asset (demo only) |
| PLACE  | `src/assets/images/avatar-placeholder.svg` — fallback for real users without a hosted image |

---

## Phase 1 — Abstract the Page System

The 723-line `spock-vs-data.njk` has three separable concerns: config, CSS, and JS. The JS has zero Spock/Data-specific logic — every character reference comes from the API response keys.

### 1a. Extract CSS → `src/_includes/head-to-head-demo.css.njk`
Copy the entire `<style>` block from `spock-vs-data.njk` verbatim. The `.svd-` prefix is fine as a namespace.

### 1b. Extract JS → `src/_includes/head-to-head-demo.js.njk`
Copy the entire `<script>` block with these Nunjucks parameterizations:

**1. Character ID arrays** — replace the two hardcoded `['spock', 'data']` literals with:
```js
{{ characterIds | dump | safe }}.forEach(function(id) {
```

**2. API fetch URL** — replace hardcoded `/api/signal-demo-evals-get` with:
```js
fetch('/api/signal-demo-evals-get?demo={{ demoId }}')
```
Change from `POST` with body `'{}'` to a plain `GET`.

**3. Name rendering** — wherever the JS uses `profile.displayName`, update to `profile.nickname || profile.displayName`. Demo characters show "Kirk" or "Spock"; real Signal users show their nickname or full name.

**4. Avatar rendering** — `<img src="${profile.avatarUrl || '/assets/images/avatar-placeholder.svg'}">` — falls back to placeholder if unset.

Nunjucks variables needed in scope: `demoId` (string), `characterIds` (array of two strings). Nothing else.

### 1c. Refactor `spock-vs-data.njk` to ~60 lines
Front matter is IDs + copy only — no data that already lives in Firestore:
```yaml
---
demoId: "spock-vs-data"
characterIds: ["spock", "data"]
heroTitle: "Two Legends.<br>Seven Job Openings."
heroSubtitle: "..."
---
```
No `char1`/`char2` objects. No display names, no image paths. Everything about a character (name, avatar, tagline, skills, scores) comes from the API response. The JS creates profile card DOM elements dynamically using `characterIds`.

**Verify `/spock-vs-data/` works identically before proceeding.**

---

## Phase 2 — Update the Endpoint

**File:** `netlify/functions/signal-demo-evals-get.js`

### 2a. Add `DEMO_CONFIG` map and `demoId` param

```js
const demoId = event.queryStringParameters?.demo || 'spock-vs-data';

const DEMO_CONFIG = {
  'spock-vs-data': {
    signalIds: ['spock', 'data'],
    roleOrder: ['Starship Captain', 'Senior Software Engineer', 'Crisis Negotiator', 'Counselor', 'Chief Technology Officer', 'Stand-up Comedian']
  },
  'kirk-vs-data': {
    signalIds: ['kirk', 'data'],
    roleOrder: ['Starship Captain', 'Chief Engineer', 'Counselor', 'Startup Founder', 'Chief Technology Officer', 'Venture Capitalist', 'Nanny']
  }
};
const { signalIds, roleOrder } = DEMO_CONFIG[demoId] || DEMO_CONFIG['spock-vs-data'];
```

### 2b. Filter evals by `demoId`
Change the Firestore query from `where('demo', '==', true)` to:
```js
.where('demo', '==', true).where('demoId', '==', demoId)
```
Requires a Firestore composite index on `(demo, demoId)`. Firestore will throw `FAILED_PRECONDITION` on first run with a creation URL — create the index before deploying. **Migration (Phase 3a) must run before this endpoint change deploys.**

### 2c. Dynamic profile loading
Replace hardcoded `getOwnerBySignalId('spock')` / `('data')` with:
```js
const [evalsSnap, ...ownerDocs] = await Promise.all([
  db.collection('signal-evaluations').where('demo','==',true).where('demoId','==',demoId).get(),
  ...signalIds.map(id => getOwnerBySignalId(id))
]);
const profiles = {};
signalIds.forEach((id, i) => { profiles[id] = buildProfile(ownerDocs[i]); });
```

### 2d. CDN caching — effectively one DB read per day

```js
headers: {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
  // ...existing headers
}
```

Netlify CDN caches the full JSON response at the edge for 24h. Worst case: one function invocation + one DB read per day regardless of traffic volume. `stale-while-revalidate` means no cold-start latency at cache expiry. Covers all demo page traffic.

### 2e. `nickname` + `avatarUrl` on owner profiles

Add two optional fields to the `signal-owner` schema:
- `nickname: string` — short display name for head-to-head contexts (e.g. `"Kirk"`). Falls back to `displayName`.
- `avatarUrl: string` — image URL. Falls back to `/assets/images/avatar-placeholder.svg`.

The endpoint returns both. The JS uses `profile.nickname || profile.displayName` and the avatar fallback pattern. Demo page front matter never touches character names or images — just IDs.

**Avatar URL strategy — pragmatic now, future-proof by design:**
- `avatarUrl` is always a string. Value evolves without schema or code changes.
- Demo characters: `/assets/images/kirk.jpg` etc. — static files in the repo
- Real users (now): omitted → placeholder fallback
- Real users (later): hosted URL (Cloudinary, S3, etc.) — simple data patch, no code change

For existing Spock and Data owners: patch `nickname` + `avatarUrl` in the migration script (Phase 3a). Kirk's are set in the seed script.

---

## Phase 3 — Migration + Seed + Precompute

### 3a. `scripts/demo/migrate-demo-eval-demoIds.cjs` (run first)
One-time script:
1. Query all `signal-evaluations` where `demo == true`, batch-add `demoId: 'spock-vs-data'` to any missing it.
2. Patch Spock + Data owner docs to add `nickname` and `avatarUrl`.

Must run before the updated endpoint deploys.

### 3b. `scripts/demo/seed-kirk-data.cjs`
Mirrors `seed-spock-data.cjs`. Key differences:
- `OWNERS` contains only Kirk (Data already exists, skip gracefully)
- Call `signal-context-synthesize` only for Kirk
- `_userId: 'u-1000000000-kirk'`, `_signalId: 'kirk'`

**Kirk owner doc:**
```js
{
  _userId: 'u-1000000000-kirk',
  displayName: 'James T. Kirk',
  nickname: 'Kirk',
  tagline: "Captain, USS Enterprise. Human. Unrepentantly so.",
  avatarUrl: '/assets/images/kirk.jpg',
  contextText: "James T. Kirk is a Starfleet officer and commanding officer of the USS Enterprise. Youngest captain in Starfleet history at appointment. Known for rule-bending when he believes he is right, psychological manipulation of adversaries, and extreme loyalty to individual crew members. Operates on intuition shaped by experience rather than logical deduction. Has a documented pattern of finding third options where none are supposed to exist.",
  status: 'active'
}
```

**10 Kirk episode chunks** (key skills designed to appear in 3+ chunks to pass confidence filter):

| Slug | Episode | Key signals |
|------|---------|-------------|
| `corbomite-maneuver` | The Corbomite Maneuver (S1E10) | Psychological leverage, strategic deception, high-stakes bluffing |
| `court-martial` | Court Martial (S1E20) | Institutional defiance, personal integrity, self-advocacy |
| `city-on-edge-of-forever` | The City on the Edge of Forever (S1E28) | Sacrifice of personal desire, mission prioritization, grief under command |
| `space-seed` | Space Seed (S1E22) | Overconfidence reading charismatic adversaries (edge), adversary respect |
| `private-little-war` | A Private Little War (S2E19) | Murky ethics, geopolitical cold-calculus, carrying moral weight |
| `amok-time` | Amok Time (S2E1) | Crew loyalty over institutional compliance, relational leadership (edge) |
| `enterprise-incident` | The Enterprise Incident (S3E2) | Multi-layer deception, intelligence ops, adaptive leadership |
| `wrath-of-khan` | Star Trek II: The Wrath of Khan | Tactical improvisation, adversary psychology reading, inspiring under grief |
| `voyage-home` | Star Trek IV: The Voyage Home | Improvisational leadership outside institutional context, charisma as resource |
| `generations` | Star Trek: Generations | Leadership legacy, self-knowledge, chooses action over comfort |

Each chunk has full schema: `topics`, `skills`, `technologies`, `projects`, `wants`, `personalitySignals` (mix of strength/edge), `concepts`, `dimensionCoverage`, `evidenceStrength`.

### 3c. `scripts/demo/precompute-kirk-data.cjs`
Mirrors `precompute-spock-data.cjs`. Key differences:
- `CHARACTERS = ['kirk', 'data']`
- Add `demoId: 'kirk-vs-data'` to every stored evaluation
- Output file: `precomputed-eval-ids-kirk-data.json`
- `ROLES` array: 7 new JDs

**The 7 role JDs** (crafted to let Signal's scoring produce the expected narrative arc naturally):

| Role | JD emphasis | Expected result |
|------|-------------|-----------------|
| **Starship Captain** | Relational trust, inspiring under pressure, intuitive command, crew home | Kirk wins (personality + alignment edge) |
| **Chief Engineer** | Deep systems knowledge, precision, accurate constraint communication, process over heroics | Data wins clearly |
| **Counselor** | Emotional availability, sitting with distress without rushing to fix, relational work | Both fail differently (~3-5) |
| **Startup Founder** | Risk tolerance, operating outside structures, charismatic recruiting, bias toward action | Kirk wins, closer than expected |
| **CTO** | Engineering org leadership, technical communication, shipping at scale | Data wins |
| **Venture Capitalist** | People pattern recognition + analytical rigor — both valued equally in JD | Genuinely ambiguous |
| **Nanny** | Emotional availability, invisibility, routine without rigidity, children respond to relationship not authority | Both fail; Kirk for the most revealing reason |

---

## Phase 4 — Build `kirk-vs-data.njk`

Thin wrapper — IDs + copy only:
```yaml
---
demoId: "kirk-vs-data"
characterIds: ["kirk", "data"]
heroTitle: "Instinct vs. Logic.<br>Seven Job Openings."
heroSubtitle: "Signal builds a behavioral profile from work history, then scores fit for skills, alignment, and personality. We ran it on Kirk and Data."
---
```
HTML structure identical to refactored `spock-vs-data.njk`. Names, avatars, taglines, skills, scores — all from the API response.

---

## Execution Order

1. Abstract page (Phase 1) → verify `/spock-vs-data/` still works identically
2. Create + run migration script (3a) — patches evals + Spock/Data owner docs
3. Update endpoint (Phase 2) — deploy after migration runs
4. Source + place `kirk.jpg` and `avatar-placeholder.svg`
5. Run seed script (3b) → verify Kirk's `synthesizedContext` + `skillsProfile` in Firestore
6. Run precompute (3c) → check `precomputed-eval-ids-kirk-data.json` for 14 IDs
7. Spot-check 2-3 Kirk evals in Firestore: `demoId` set, scores in valid range, evidence populated
8. Build `kirk-vs-data.njk` (Phase 4)

---

## Pitfalls

- **Firestore composite index**: `(demo, demoId)` must exist before endpoint deploys. Run locally first to get the Firestore console creation URL.
- **Migration must precede endpoint deploy**: Updated endpoint queries `demoId == 'spock-vs-data'` — returns zero results if migration hasn't run.
- **Kirk synthesis quality**: If key skills appear in <2 chunks, confidence filtering will drop them. Kirk's chunks were designed to repeat skills across 3+ episodes, but spot-check after synthesis. A patch script (`patch-demo-skills.cjs` pattern) can fix it if needed.
- **`characterIds` in Nunjucks**: Verify `{{ characterIds | dump | safe }}` emits valid JSON array inline in the JS block.

---

## Verification

```bash
# Spock vs Data still works
curl "http://localhost:8888/api/signal-demo-evals-get?demo=spock-vs-data"
# → profiles: { spock, data }, evalsByRole with 6 roles

# Kirk vs Data returns data
curl "http://localhost:8888/api/signal-demo-evals-get?demo=kirk-vs-data"
# → profiles: { kirk, data }, evalsByRole with 7 roles

# No role bleed (no "Nanny" in spock response, no "Stand-up Comedian" in kirk response)

# Both pages render correctly, role picker works, scores animate
```
