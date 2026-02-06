# Phase 2: Move habitual-web to apps/

## Objective
Move the existing HabitualOS app to `apps/habitual-web/` and update all imports to use the shared `@habitualos/db-core` package.

## Context
After Phase 1, we have `@habitualos/db-core` working. Now we restructure the existing app into the monorepo layout without breaking functionality.

## Prerequisites
- Completed Phase 1 (shared package tested and working)
- On `monorepo-migration` branch

## Current Structure → Target Structure

```
# CURRENT                           # TARGET
src/                          →     apps/habitual-web/src/
netlify/                      →     apps/habitual-web/netlify/
.eleventy.js                  →     apps/habitual-web/.eleventy.js
netlify.toml                  →     apps/habitual-web/netlify.toml
docs/                         →     apps/habitual-web/docs/
```

---

## Steps

### Step 2.1: Create apps/habitual-web directory

```bash
mkdir -p apps/habitual-web
```

### Step 2.2: Move directories and files

```bash
# Move main directories
mv src apps/habitual-web/
mv netlify apps/habitual-web/
mv docs apps/habitual-web/

# Move config files
mv .eleventy.js apps/habitual-web/
mv netlify.toml apps/habitual-web/

# Also move these if they exist
mv css apps/habitual-web/ 2>/dev/null || true
mv _site apps/habitual-web/ 2>/dev/null || true
```

### Step 2.3: Create apps/habitual-web/package.json

```json
{
  "name": "habitual-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "sass:build": "sass src/styles/main.scss:_site/css/main.css --style=compressed",
    "sass:watch": "sass src/styles/main.scss:_site/css/main.css --watch",
    "eleventy:build": "eleventy",
    "eleventy:serve": "eleventy --serve",
    "dev": "npm-run-all --parallel sass:watch eleventy:serve",
    "build": "npm-run-all sass:build eleventy:build"
  },
  "dependencies": {
    "@habitualos/db-core": "workspace:*",
    "@11ty/eleventy": "^2.0.1",
    "@anthropic-ai/sdk": "^0.71.2",
    "marked": "^15.0.12",
    "node-cron": "^4.2.1",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5",
    "sass": "^1.69.5"
  }
}
```

### Step 2.4: Update apps/habitual-web/netlify.toml

Replace the contents with:

```toml
# =============================================================================
# Build & Dev (Monorepo paths)
# =============================================================================

[build]
  command = "cd ../.. && pnpm --filter habitual-web build"
  publish = "apps/habitual-web/_site"
  functions = "apps/habitual-web/netlify/functions"

[dev]
  command = "pnpm dev"
  targetPort = 8080
  autoLaunch = false

# =============================================================================
# Node.js Functions
# =============================================================================

[functions]
  node_bundler = "esbuild"
  included_files = ["apps/habitual-web/docs/**/*.md"]

[functions."agent-chat"]
  timeout = 26

# =============================================================================
# Edge Functions
# =============================================================================

[[edge_functions]]
  path = "/api/chat-stream"
  function = "chat-stream"

[[edge_functions]]
  path = "/api/agent-chat-stream"
  function = "agent-chat-stream"

# =============================================================================
# Redirects
# =============================================================================

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/do/action/*"
  to = "/do/action/"
  status = 200
  force = true

[[redirects]]
  from = "/do/file/*"
  to = "/do/file/"
  status = 200
  force = true
```

### Step 2.5: Update all service file imports

All files in `apps/habitual-web/netlify/functions/_services/` that require db-core need updates.

**Files to update** (find them with: `grep -l "require.*db-core" apps/habitual-web/netlify/functions/_services/`):

For each file, change:
```javascript
// FROM:
const dbCore = require('./db-core.cjs');
// or
const { create, patch, get, query } = require('./db-core.cjs');

// TO:
const { create, patch, get, query, remove, increment } = require('@habitualos/db-core');
```

**Note**: Only import the functions actually used in each file.

### Step 2.6: Update firestore imports

Files in `_utils/` or `_agent-core/` that import firestore directly:

```javascript
// FROM:
const { db } = require('./firestore.cjs');
// or
const { db, admin } = require('../_utils/firestore.cjs');

// TO:
const { db, admin, FieldValue, Timestamp } = require('@habitualos/db-core');
```

### Step 2.7: Keep data-utils.cjs in the app

The file `apps/habitual-web/netlify/functions/_utils/data-utils.cjs` has domain-specific ID generators (generateAgentId, generateActionId, etc.). **Keep this file as-is** - it's HabitualOS-specific.

However, if any file imports `uniqueId` from data-utils.cjs, it can optionally use the shared package instead:
```javascript
const { uniqueId } = require('@habitualos/db-core');
```

### Step 2.8: Delete the old db-core.cjs and firestore.cjs

These are now in the shared package:
```bash
rm apps/habitual-web/netlify/functions/_services/db-core.cjs
rm apps/habitual-web/netlify/functions/_utils/firestore.cjs
```

### Step 2.9: Install dependencies

```bash
pnpm install
```

---

## Verification

### Step 2.10: Test local development

```bash
cd apps/habitual-web
pnpm dev
```

In another terminal:
```bash
# Test an endpoint
curl "http://localhost:8888/api/agents-list?userId=u-mgpqwa49"

# Should return JSON with agents array
```

### Step 2.11: Test multiple endpoints

```bash
# Actions
curl "http://localhost:8888/api/action-list?userId=u-mgpqwa49"

# Practices
curl "http://localhost:8888/api/practice-list?userId=u-mgpqwa49"
```

### Step 2.12: Test the frontend

1. Open http://localhost:8888 in browser
2. Navigate to /do/ (agents page)
3. Verify agents load
4. Try opening an agent's chat

---

## Verification Checklist
- [ ] `apps/habitual-web/` has all the moved files
- [ ] No `db-core.cjs` or `firestore.cjs` in `_services/` or `_utils/`
- [ ] All service files import from `@habitualos/db-core`
- [ ] `pnpm install` succeeds
- [ ] `pnpm dev` starts the dev server
- [ ] API endpoints return data
- [ ] Frontend loads and works

## Commit
```bash
git add -A
git commit -m "Phase 2: Move habitual-web to apps/ directory"
```

## Troubleshooting

### "Cannot find module '@habitualos/db-core'"
- Run `pnpm install` from repo root
- Check `packages/db-core/package.json` has correct name

### "Cannot find module './firestore.cjs'"
- You may have missed updating an import
- Search: `grep -r "require.*firestore" apps/habitual-web/netlify/functions/`

### Build errors about missing dependencies
- Some deps may need to move to `apps/habitual-web/package.json`
- Check error message for specific module name

## Next Phase
When verification passes, proceed to [Phase 3: Create relationship-web](./monorepo-Phase3.md)
