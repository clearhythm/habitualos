# Phase 1: Create Workspace Foundation

## Objective
Set up pnpm workspaces and extract the shared `@habitualos/db-core` package.

## Context
We need a shared Firestore CRUD layer that both `habitual-web` and `relationship-web` can use. This package extracts the minimal infrastructure:
- `firestore.cjs` - Firebase Admin SDK initialization
- `db-core.cjs` - Generic CRUD operations (create, patch, get, query, remove, increment)
- `data-utils.cjs` - `uniqueId()` function for ID generation

## Prerequisites
- Completed Phase 0 (on `monorepo-migration` branch)
- pnpm installed (`npm install -g pnpm` if needed)

## Current File Locations
The files to extract are currently at:
- `netlify/functions/_utils/firestore.cjs`
- `netlify/functions/_services/db-core.cjs`
- `netlify/functions/_utils/data-utils.cjs` (only `uniqueId()` needed)

---

## Steps

### Step 1.1: Create pnpm-workspace.yaml

Create `/pnpm-workspace.yaml` at repo root:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### Step 1.2: Create packages/db-core directory structure

```bash
mkdir -p packages/db-core
```

### Step 1.3: Create packages/db-core/package.json

```json
{
  "name": "@habitualos/db-core",
  "version": "1.0.0",
  "main": "index.cjs",
  "dependencies": {
    "firebase-admin": "^13.6.0",
    "dotenv": "^16.6.1"
  }
}
```

### Step 1.4: Copy firestore.cjs

Copy `netlify/functions/_utils/firestore.cjs` to `packages/db-core/firestore.cjs` (no changes needed).

### Step 1.5: Copy and modify db-core.cjs

Copy `netlify/functions/_services/db-core.cjs` to `packages/db-core/db-core.cjs`.

**Change this line** (line 19):
```javascript
// FROM:
const { db, admin } = require("../_utils/firestore.cjs");

// TO:
const { db, admin } = require("./firestore.cjs");
```

### Step 1.6: Create simplified data-utils.cjs

Create `packages/db-core/data-utils.cjs` with only the generic uniqueId:

```javascript
/**
 * packages/db-core/data-utils.cjs
 *
 * Generic ID generation utility shared across apps.
 * Domain-specific ID generators (generateAgentId, etc.) stay in each app.
 */

function uniqueId(prefix = "") {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`;
}

module.exports = { uniqueId };
```

### Step 1.7: Create packages/db-core/index.cjs

```javascript
/**
 * @habitualos/db-core
 *
 * Shared Firestore infrastructure for all HabitualOS apps.
 * Provides:
 *   - Firebase Admin initialization (db, admin, FieldValue, Timestamp)
 *   - Generic CRUD operations (create, patch, get, query, remove, increment)
 *   - ID generation (uniqueId)
 */

const dbCore = require('./db-core.cjs');
const { db, admin, FieldValue, Timestamp } = require('./firestore.cjs');
const { uniqueId } = require('./data-utils.cjs');

module.exports = {
  // CRUD operations
  create: dbCore.create,
  patch: dbCore.patch,
  get: dbCore.get,
  query: dbCore.query,
  remove: dbCore.remove,
  increment: dbCore.increment,

  // Firestore access
  db,
  admin,
  FieldValue,
  Timestamp,

  // Utilities
  uniqueId
};
```

### Step 1.8: Update root package.json

Replace the contents of `/package.json` with:

```json
{
  "name": "habitualos-monorepo",
  "private": true,
  "scripts": {
    "dev:habitual": "pnpm --filter habitual-web dev",
    "dev:relationship": "pnpm --filter relationship-web dev",
    "build:habitual": "pnpm --filter habitual-web build",
    "build:relationship": "pnpm --filter relationship-web build",
    "build:all": "pnpm -r build"
  },
  "devDependencies": {
    "netlify-cli": "^17.0.0"
  }
}
```

### Step 1.9: Install dependencies

```bash
pnpm install
```

This should:
- Create `pnpm-lock.yaml`
- Install firebase-admin and dotenv in packages/db-core
- Set up workspace linking

---

## Checkpoint: Test with one service file

Before moving everything, verify the shared package works.

### Step 1.10: Update ONE service file as a test

Pick a simple service file: `netlify/functions/_services/db-user-feedback.cjs`

Change its imports:
```javascript
// FROM:
const dbCore = require('./db-core.cjs');

// TO:
const { create, query } = require('@habitualos/db-core');
```

### Step 1.11: Test the endpoint

```bash
netlify dev
```

In another terminal, test:
```bash
curl "http://localhost:8888/api/feedback-list?userId=u-mgpqwa49"
```

Expected: Returns JSON (empty array is fine, no errors).

### Decision Point
- **If it works** → Proceed to Phase 2
- **If it fails** → Debug the bundler/import issue before continuing

---

## Verification Checklist
- [ ] `packages/db-core/` directory exists with all 4 files
- [ ] `pnpm-workspace.yaml` exists at root
- [ ] `pnpm install` completes without errors
- [ ] `pnpm list` shows `@habitualos/db-core` in workspace
- [ ] Test endpoint works with the shared package

## Commit
```bash
git add -A
git commit -m "Phase 1: Create @habitualos/db-core shared package"
```

## Rollback (if needed)
```bash
git checkout main -- netlify/functions/_services/db-user-feedback.cjs
rm -rf packages/ pnpm-workspace.yaml pnpm-lock.yaml
# Then restore original package.json
```

## Next Phase
When verification passes, proceed to [Phase 2: Move habitual-web](./monorepo-Phase2.md)
