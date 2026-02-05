# Phase 3: Create relationship-web App

## Objective
Stand up the new `apps/relationship-web` app with basic "moments" CRUD functionality, using the same auth, ownership, and Firestore patterns as habitual-web.

## Context
With the monorepo structure in place and habitual-web working, we can now add the second app. This app tracks relationship "moments" - interactions, conversations, milestones with people in your life.

## Prerequisites
- Completed Phase 2 (habitual-web working in apps/)
- On `monorepo-migration` branch

## Target Structure

```
apps/relationship-web/
├── package.json
├── netlify.toml
├── .eleventy.js
├── src/
│   ├── _includes/
│   │   └── base.njk
│   ├── index.njk
│   └── assets/
│       └── js/
│           └── auth.js
└── netlify/
    └── functions/
        ├── _services/
        │   └── db-moments.cjs
        ├── moments-create.js
        └── moments-list.js
```

---

## Steps

### Step 3.1: Create directory structure

```bash
mkdir -p apps/relationship-web/{src/_includes,src/assets/js,netlify/functions/_services}
```

### Step 3.2: Create apps/relationship-web/package.json

```json
{
  "name": "relationship-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "eleventy:build": "eleventy",
    "eleventy:serve": "eleventy --serve",
    "dev": "eleventy --serve",
    "build": "eleventy"
  },
  "dependencies": {
    "@habitualos/db-core": "workspace:*",
    "@11ty/eleventy": "^2.0.1"
  }
}
```

### Step 3.3: Create apps/relationship-web/.eleventy.js

```javascript
module.exports = function(eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/assets");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk"
  };
};
```

### Step 3.4: Create apps/relationship-web/netlify.toml

```toml
# =============================================================================
# Build & Dev
# =============================================================================

[build]
  command = "cd ../.. && pnpm --filter relationship-web build"
  publish = "apps/relationship-web/_site"
  functions = "apps/relationship-web/netlify/functions"

[dev]
  command = "pnpm dev"
  targetPort = 8080
  autoLaunch = false

# =============================================================================
# Functions
# =============================================================================

[functions]
  node_bundler = "esbuild"

# =============================================================================
# Redirects
# =============================================================================

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

### Step 3.5: Create the moments service

**apps/relationship-web/netlify/functions/_services/db-moments.cjs**:

```javascript
/**
 * db-moments.cjs - Relationship Moments Service
 *
 * A "moment" is a meaningful interaction with someone in your life.
 * Examples: a conversation, receiving/giving a gift, a milestone, a memory.
 *
 * Collection: moments
 * Ownership: _userId (same pattern as HabitualOS)
 */

const { create, query, get, patch, remove, uniqueId } = require('@habitualos/db-core');

const COLLECTION = 'moments';

/**
 * Generate a unique moment ID
 * Format: moment-{timestamp36}{random4}
 */
function generateMomentId() {
  return uniqueId('moment');
}

/**
 * Create a new moment
 *
 * @param {Object} params
 * @param {string} params.userId - Owner's user ID (required)
 * @param {string} params.personId - ID of the person this moment is with (optional)
 * @param {string} params.personName - Name of the person (for display)
 * @param {string} params.type - Type: 'conversation', 'gift', 'milestone', 'memory', 'note'
 * @param {string} params.content - Description of the moment
 * @param {string} params.occurredAt - When it happened (ISO string, defaults to now)
 * @returns {Promise<{id: string}>}
 */
async function createMoment({ userId, personId, personName, type, content, occurredAt }) {
  const id = generateMomentId();

  await create({
    collection: COLLECTION,
    id,
    data: {
      _userId: userId,
      personId: personId || null,
      personName: personName || null,
      type: type || 'note',
      content: content || '',
      occurredAt: occurredAt || new Date().toISOString()
    }
  });

  return { id };
}

/**
 * Get all moments for a user
 *
 * @param {string} userId
 * @returns {Promise<Array>} Moments sorted by occurredAt desc
 */
async function getMomentsByUserId(userId) {
  return query({
    collection: COLLECTION,
    where: `_userId::eq::${userId}`,
    orderBy: 'occurredAt::desc'
  });
}

/**
 * Get a single moment by ID
 *
 * @param {string} id - Moment ID
 * @returns {Promise<Object|null>}
 */
async function getMoment(id) {
  return get({ collection: COLLECTION, id });
}

/**
 * Update a moment
 *
 * @param {string} id - Moment ID
 * @param {Object} data - Fields to update
 * @returns {Promise<{id: string}>}
 */
async function updateMoment(id, data) {
  return patch({ collection: COLLECTION, id, data });
}

/**
 * Delete a moment
 *
 * @param {string} id - Moment ID
 * @returns {Promise<{id: string}>}
 */
async function deleteMoment(id) {
  return remove({ collection: COLLECTION, id });
}

module.exports = {
  generateMomentId,
  createMoment,
  getMomentsByUserId,
  getMoment,
  updateMoment,
  deleteMoment
};
```

### Step 3.6: Create moments-list.js endpoint

**apps/relationship-web/netlify/functions/moments-list.js**:

```javascript
/**
 * GET /api/moments-list
 *
 * List all moments for a user.
 *
 * Query params:
 *   - userId (required): User ID (format: u-{id})
 *
 * Response:
 *   { success: true, moments: [...] }
 */

const { getMomentsByUserId } = require('./_services/db-moments.cjs');

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Parse query params
  const { userId } = event.queryStringParameters || {};

  // Validate userId
  if (!userId || !userId.startsWith('u-')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Valid userId required' })
    };
  }

  try {
    const moments = await getMomentsByUserId(userId);

    // Convert Firestore timestamps to ISO strings
    const formatted = moments.map(m => ({
      ...m,
      _createdAt: m._createdAt?.toDate?.()?.toISOString() || m._createdAt,
      _updatedAt: m._updatedAt?.toDate?.()?.toISOString() || m._updatedAt
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, moments: formatted })
    };
  } catch (error) {
    console.error('moments-list error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
```

### Step 3.7: Create moments-create.js endpoint

**apps/relationship-web/netlify/functions/moments-create.js**:

```javascript
/**
 * POST /api/moments-create
 *
 * Create a new moment.
 *
 * Request body:
 *   - userId (required): User ID
 *   - personName (optional): Name of the person
 *   - type (optional): 'conversation', 'gift', 'milestone', 'memory', 'note'
 *   - content (required): Description of the moment
 *   - occurredAt (optional): ISO date string (defaults to now)
 *
 * Response:
 *   { success: true, moment: { id, ... } }
 */

const { createMoment, getMoment } = require('./_services/db-moments.cjs');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
    };
  }

  const { userId, personName, type, content, occurredAt } = body;

  // Validate required fields
  if (!userId || !userId.startsWith('u-')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Valid userId required' })
    };
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Content is required' })
    };
  }

  try {
    const { id } = await createMoment({
      userId,
      personName,
      type,
      content: content.trim(),
      occurredAt
    });

    // Fetch the created moment to return full object
    const moment = await getMoment(id);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, moment })
    };
  } catch (error) {
    console.error('moments-create error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
```

### Step 3.8: Create basic frontend

**apps/relationship-web/src/_includes/base.njk**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title | default("Relationship Web") }}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    .moment {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .moment-type {
      font-size: 0.75rem;
      color: #666;
      text-transform: uppercase;
    }
    .moment-person { color: #0066cc; }
    .moment-date { font-size: 0.85rem; color: #999; }
    form { margin-bottom: 2rem; }
    input, textarea, select, button {
      display: block;
      width: 100%;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    button {
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #0052a3; }
  </style>
</head>
<body>
  {{ content | safe }}
  <script type="module" src="/assets/js/auth.js"></script>
</body>
</html>
```

**apps/relationship-web/src/index.njk**:

```html
---
layout: base.njk
title: Relationship Web - Moments
---

<h1>Relationship Moments</h1>

<form id="moment-form">
  <input type="text" id="personName" placeholder="Person's name (optional)">
  <select id="type">
    <option value="note">Note</option>
    <option value="conversation">Conversation</option>
    <option value="gift">Gift</option>
    <option value="milestone">Milestone</option>
    <option value="memory">Memory</option>
  </select>
  <textarea id="content" placeholder="What happened?" rows="3" required></textarea>
  <button type="submit">Add Moment</button>
</form>

<div id="moments-list">Loading...</div>

<script type="module">
  // Simple auth - same pattern as HabitualOS
  const LOCAL_STORAGE_KEY = "user";

  function generateUserId() {
    const t = (Date.now() * 1000 + Math.random() * 1000).toString(36).slice(-8);
    return 'u-' + t;
  }

  function initializeUser() {
    let user;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      user = raw ? JSON.parse(raw) : null;
    } catch (e) {
      user = null;
    }

    if (!user || !user._userId) {
      user = {
        _userId: generateUserId(),
        _createdAt: new Date().toISOString()
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    }

    return user._userId;
  }

  const userId = initializeUser();

  // Load moments
  async function loadMoments() {
    const res = await fetch(`/api/moments-list?userId=${userId}`);
    const data = await res.json();

    const container = document.getElementById('moments-list');
    if (!data.success || !data.moments.length) {
      container.innerHTML = '<p>No moments yet. Add your first one above!</p>';
      return;
    }

    container.innerHTML = data.moments.map(m => `
      <div class="moment">
        <span class="moment-type">${m.type || 'note'}</span>
        ${m.personName ? `<span class="moment-person"> with ${m.personName}</span>` : ''}
        <p>${m.content}</p>
        <span class="moment-date">${new Date(m.occurredAt).toLocaleDateString()}</span>
      </div>
    `).join('');
  }

  // Handle form submit
  document.getElementById('moment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const personName = document.getElementById('personName').value;
    const type = document.getElementById('type').value;
    const content = document.getElementById('content').value;

    const res = await fetch('/api/moments-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, personName, type, content })
    });

    if (res.ok) {
      document.getElementById('content').value = '';
      document.getElementById('personName').value = '';
      loadMoments();
    }
  });

  // Initial load
  loadMoments();
</script>
```

**apps/relationship-web/src/assets/js/auth.js** (placeholder - actual auth is inline above):

```javascript
// Auth utilities for relationship-web
// Currently using inline auth in index.njk
// Can be expanded as app grows
export function getUserId() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return user._userId || null;
  } catch (e) {
    return null;
  }
}
```

### Step 3.9: Install dependencies

```bash
pnpm install
```

---

## Verification

### Step 3.10: Test local development

```bash
cd apps/relationship-web
pnpm dev
```

### Step 3.11: Test API endpoints

```bash
# List moments (should be empty)
curl "http://localhost:8888/api/moments-list?userId=u-test123"

# Create a moment
curl -X POST "http://localhost:8888/api/moments-create" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u-test123","personName":"Alice","type":"conversation","content":"Had coffee and talked about the project"}'

# List again (should show the moment)
curl "http://localhost:8888/api/moments-list?userId=u-test123"
```

### Step 3.12: Test the frontend

1. Open http://localhost:8888 in browser
2. Add a moment using the form
3. Verify it appears in the list
4. Refresh the page - moment should persist

---

## Verification Checklist
- [ ] `apps/relationship-web/` has all required files
- [ ] `pnpm install` succeeds
- [ ] `pnpm dev` starts the dev server
- [ ] API endpoints work (list, create)
- [ ] Frontend loads and can add/view moments
- [ ] Data persists across page refreshes

## Commit
```bash
git add -A
git commit -m "Phase 3: Create relationship-web app with moments CRUD"
```

## Next Phase
When verification passes, proceed to [Phase 4: Netlify Deployment](./monorepo-Phase4.md)
