# TICKET-6: Network Dashboard Page `/network/`

## Why this exists

All the backend infrastructure is built (TICKET-1 through TICKET-5). This ticket adds the owner-facing UI: a page where Signal owners can run discovery queries, import LinkedIn CSV, scrape individual URLs, and view/filter all their scored contacts in a table. Owner-only — same auth guard as dashboard.js.

This is TICKET-6 of 6. Depends on all prior tickets.

---

## Read first

- `src/dashboard.njk` — page template structure and auth guard pattern to copy
- `src/assets/js/dashboard.js` — `$on`, `setVal`, `setText`, `setHidden` helpers; auth check pattern (`localStorage.getItem('signal-owner-id')`, fetch `/api/signal-config-get`, redirect to `/signin/`)
- `src/styles/main.scss` — where to add the new `@import 'network'`
- `src/styles/_score.scss` — SCSS variable usage patterns (use `$color-*` vars, no hardcoded hex)

---

## Step 1: Create `netlify/functions/signal-contacts-get.js`

Simple read endpoint — returns all contacts for an owner.

```js
require('dotenv').config();
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { getContactsByOwnerId } = require('./_services/db-signal-contacts.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, status } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const contacts = await getContactsByOwnerId(owner.signalId, { limit: 200, status });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, contacts }),
    };

  } catch (error) {
    console.error('[signal-contacts-get] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
```

---

## Step 2: Create `src/network.njk`

```njk
---
layout: base.njk
title: "Signal — Network"
pageTitle: Network
description: "Discover and connect with people who match your Signal profile."
pageScript: /assets/js/network.js
---

<div class="network-wrap">

  <!-- Auth guard -->
  <div id="network-loading" class="network-loading">
    <p class="text-muted">Loading…</p>
  </div>

  <!-- Main (shown after auth) -->
  <div id="network-main" hidden>

    <div class="network-header">
      <h1 class="network-title">Network</h1>
      <p class="network-desc text-muted">Find people who match your Signal profile.</p>
    </div>

    <div class="network-sections">

      <!-- Discovery -->
      <section class="network-section">
        <h2 class="network-section-title">Discover people</h2>
        <p class="network-section-desc">Enter one search query per line. Signal will find matching profiles and score them.</p>
        <form id="network-discover-form">
          <textarea class="network-textarea" id="network-discover-queries" rows="4"
            placeholder="product designers building AI tools NYC&#10;ML engineers open to consulting&#10;founders interested in behavioral science"></textarea>
          <div class="network-form-actions">
            <button type="submit" class="btn btn-primary" id="network-discover-btn">Find people →</button>
            <span class="network-status" id="network-discover-status"></span>
          </div>
        </form>
      </section>

      <!-- CSV Import -->
      <section class="network-section">
        <h2 class="network-section-title">Import LinkedIn connections</h2>
        <p class="network-section-desc">Export your LinkedIn connections (Settings → Data Privacy → Connections) and paste the CSV here.</p>
        <form id="network-csv-form">
          <textarea class="network-textarea" id="network-csv-text" rows="4"
            placeholder="First Name,Last Name,Email Address,Company,Position,Connected On&#10;Jane,Smith,,Acme Corp,Head of Product,01 Jan 2024&#10;…"></textarea>
          <div class="network-form-actions">
            <button type="submit" class="btn btn-primary" id="network-csv-btn">Import →</button>
            <span class="network-status" id="network-csv-status"></span>
          </div>
        </form>
      </section>

      <!-- URL Scraper -->
      <section class="network-section">
        <h2 class="network-section-title">Add a person by URL</h2>
        <p class="network-section-desc">Paste a LinkedIn profile, personal site, or Substack URL.</p>
        <form id="network-scrape-form">
          <input class="network-input" id="network-scrape-url" type="url"
            placeholder="https://linkedin.com/in/..." />
          <div class="network-form-actions">
            <button type="submit" class="btn btn-primary" id="network-scrape-btn">Add person →</button>
            <span class="network-status" id="network-scrape-status"></span>
          </div>
        </form>
      </section>

    </div>

    <!-- Contacts Table -->
    <section class="network-contacts-section" id="network-contacts-section">
      <div class="network-contacts-header">
        <h2 class="network-section-title">Your network</h2>
        <div class="network-filter-tabs" id="network-filter-tabs">
          <button class="network-filter-tab active" data-filter="all">All</button>
          <button class="network-filter-tab" data-filter="high">High match (8+)</button>
          <button class="network-filter-tab" data-filter="pending">Pending outreach</button>
          <button class="network-filter-tab" data-filter="sent">Sent</button>
        </div>
      </div>

      <div id="network-contacts-empty" hidden>
        <p class="text-muted">No contacts yet. Run a discovery or import your LinkedIn connections above.</p>
      </div>

      <div class="network-table-wrap" id="network-table-wrap" hidden>
        <table class="network-contacts-table">
          <thead>
            <tr>
              <th>Person</th>
              <th class="network-score-col">Domain</th>
              <th class="network-score-col">Traj</th>
              <th class="network-score-col">Style</th>
              <th class="network-score-col">Overall</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody id="network-contacts-body"></tbody>
        </table>
      </div>
    </section>

  </div>
</div>
```

---

## Step 3: Create `src/assets/js/network.js`

```js
/**
 * network.js — Signal network discovery + contacts dashboard
 */

import { apiUrl } from './api.js';

const loading = document.getElementById('network-loading');
const main    = document.getElementById('network-main');

let ownerConfig = null;
let allContacts = [];
let activeFilter = 'all';
let discoverPollTimer = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

(async () => {
  const signalId = localStorage.getItem('signal-owner-id');
  if (!signalId) { redirectToSignin(); return; }

  try {
    const res = await fetch(apiUrl('/api/signal-config-get'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    const data = await res.json();
    if (!data.success || data.config.status !== 'active') { redirectToSignin(); return; }
    if (data.config._userId !== window.__userId) { redirectToSignin(); return; }

    ownerConfig = data.config;
    loading.hidden = true;
    main.hidden = false;

    initHandlers();
    await loadContacts();
  } catch {
    redirectToSignin();
  }
})();

function redirectToSignin() {
  const dest = encodeURIComponent(location.pathname);
  location.replace('/signin/?next=' + dest);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function initHandlers() {
  document.getElementById('network-discover-form').addEventListener('submit', e => {
    e.preventDefault();
    handleDiscover();
  });
  document.getElementById('network-csv-form').addEventListener('submit', e => {
    e.preventDefault();
    handleCsvImport();
  });
  document.getElementById('network-scrape-form').addEventListener('submit', e => {
    e.preventDefault();
    handleScrape();
  });
  document.getElementById('network-filter-tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    activeFilter = tab.dataset.filter;
    document.querySelectorAll('.network-filter-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderContacts(allContacts, activeFilter);
  });
}

// ─── Discovery ────────────────────────────────────────────────────────────────

async function handleDiscover() {
  const raw = document.getElementById('network-discover-queries').value.trim();
  const queries = raw.split('\n').map(q => q.trim()).filter(Boolean);
  if (!queries.length) return;

  const btn = document.getElementById('network-discover-btn');
  const status = document.getElementById('network-discover-status');
  btn.disabled = true;
  setStatus(status, 'Starting discovery…', 'muted');

  try {
    const res = await fetch(apiUrl('/api/signal-network-discover-background'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, queries }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    pollDiscoverStatus(data.jobId, status, btn);
  } catch (e) {
    setStatus(status, `Error: ${e.message}`, 'error');
    btn.disabled = false;
  }
}

function pollDiscoverStatus(jobId, status, btn) {
  let attempts = 0;
  const MAX = 150; // 7.5 min at 3s intervals

  discoverPollTimer = setInterval(async () => {
    attempts++;
    if (attempts > MAX) {
      clearInterval(discoverPollTimer);
      setStatus(status, 'Timed out. Check back later.', 'error');
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/signal-network-discover-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: window.__userId, jobId }),
      });
      const data = await res.json();

      if (data.status === 'done') {
        clearInterval(discoverPollTimer);
        const count = data.results?.length ?? 0;
        setStatus(status, `Found ${count} match${count !== 1 ? 'es' : ''}.`, 'success');
        btn.disabled = false;
        await loadContacts();
      } else if (data.status === 'error') {
        clearInterval(discoverPollTimer);
        setStatus(status, `Discovery failed: ${data.error || 'unknown error'}`, 'error');
        btn.disabled = false;
      } else {
        setStatus(status, 'Searching the web…', 'muted');
      }
    } catch {
      // transient network error — keep polling
    }
  }, 3000);
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

async function handleCsvImport() {
  const csvText = document.getElementById('network-csv-text').value.trim();
  if (!csvText) return;

  const btn = document.getElementById('network-csv-btn');
  const status = document.getElementById('network-csv-status');
  btn.disabled = true;
  setStatus(status, 'Importing…', 'muted');

  try {
    const res = await fetch(apiUrl('/api/signal-network-csv-import'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, csvText }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    setStatus(status, `Imported ${data.scored} of ${data.total} connections scored.`, 'success');
    await loadContacts();
  } catch (e) {
    setStatus(status, `Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── URL Scraper ──────────────────────────────────────────────────────────────

async function handleScrape() {
  const url = document.getElementById('network-scrape-url').value.trim();
  if (!url) return;

  const btn = document.getElementById('network-scrape-btn');
  const status = document.getElementById('network-scrape-status');
  btn.disabled = true;
  setStatus(status, 'Fetching profile…', 'muted');

  try {
    const res = await fetch(apiUrl('/api/signal-profile-scrape'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, url }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (data.notAPerson) {
      setStatus(status, "That URL doesn't appear to be a person's profile page.", 'error');
    } else {
      setStatus(status, `Added ${data.contact.name} (score: ${data.score?.overall ?? '—'}/10).`, 'success');
      document.getElementById('network-scrape-url').value = '';
      await loadContacts();
    }
  } catch (e) {
    setStatus(status, `Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

async function loadContacts() {
  try {
    const res = await fetch(apiUrl('/api/signal-contacts-get'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId }),
    });
    const data = await res.json();
    if (!data.success) return;
    allContacts = data.contacts || [];
    renderContacts(allContacts, activeFilter);
  } catch {
    // non-fatal
  }
}

function renderContacts(contacts, filter) {
  let filtered = contacts;
  if (filter === 'high') filtered = contacts.filter(c => (c.score?.overall ?? 0) >= 8);
  else if (filter === 'pending') filtered = contacts.filter(c => c.outreachStatus === 'pending');
  else if (filter === 'sent') filtered = contacts.filter(c => c.outreachStatus === 'sent');

  const empty = document.getElementById('network-contacts-empty');
  const tableWrap = document.getElementById('network-table-wrap');
  const tbody = document.getElementById('network-contacts-body');

  if (filtered.length === 0) {
    empty.hidden = false;
    tableWrap.hidden = true;
    return;
  }

  empty.hidden = true;
  tableWrap.hidden = false;

  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const statusLabel = { pending: 'Pending', sent: 'Sent', failed: 'No email', skipped: 'Skipped', unsubscribed: 'Unsubscribed' };

  tbody.innerHTML = filtered.map(c => {
    const score = c.score || {};
    const date = c._createdAt?.seconds
      ? new Date(c._createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    return `
      <tr>
        <td class="network-person-cell">
          <span class="network-person-name">${esc(c.name || '—')}</span>
          <span class="network-person-meta">${esc([c.title, c.company].filter(Boolean).join(' · '))}</span>
        </td>
        <td class="network-score-col"><span class="network-score-cell">${score.domain ?? '—'}</span></td>
        <td class="network-score-col"><span class="network-score-cell">${score.trajectory ?? '—'}</span></td>
        <td class="network-score-col"><span class="network-score-cell">${score.style ?? '—'}</span></td>
        <td class="network-score-col"><span class="network-score-cell network-score-overall">${score.overall ?? '—'}</span></td>
        <td><span class="network-status-badge network-status-badge--${esc(c.outreachStatus || 'pending')}">${esc(statusLabel[c.outreachStatus] || 'Pending')}</span></td>
        <td class="network-source-cell">${esc(c.source || '—')}</td>
      </tr>
    `;
  }).join('');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `network-status network-status--${type}`;
}
```

---

## Step 4: Create `src/styles/_network.scss`

```scss
// ─── Network page ─────────────────────────────────────────────────────────────

.network-wrap {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.network-loading {
  padding: 4rem 1.5rem;
  text-align: center;
}

.network-header {
  margin-bottom: 2rem;
}

.network-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: $color-text;
  margin: 0 0 0.25rem;
}

.network-desc {
  font-size: 0.9rem;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

.network-sections {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 2.5rem;

  @media (min-width: 700px) {
    grid-template-columns: 1fr 1fr;

    // URL scraper spans full width
    .network-section:last-child {
      grid-column: 1 / -1;
    }
  }
}

.network-section {
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: 12px;
  padding: 1.25rem;
}

.network-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: $color-text;
  margin: 0 0 0.25rem;
}

.network-section-desc {
  font-size: 0.8rem;
  color: $color-muted;
  margin: 0 0 0.75rem;
  line-height: 1.5;
}

.network-textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  background: $color-bg;
  color: $color-text;
  border: 1px solid $color-border;
  border-radius: 8px;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: $color-primary;
  }
}

.network-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  background: $color-bg;
  color: $color-text;
  border: 1px solid $color-border;
  border-radius: 8px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: $color-primary;
  }
}

.network-form-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.network-status {
  font-size: 0.8rem;

  &--muted { color: $color-muted; }
  &--success { color: $color-success; }
  &--error { color: $color-danger; }
}

// ─── Contacts table ───────────────────────────────────────────────────────────

.network-contacts-section {
  margin-top: 1rem;
}

.network-contacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.network-filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.network-filter-tab {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid $color-border;
  border-radius: 20px;
  cursor: pointer;
  color: $color-muted;
  transition: all 0.15s;

  &.active,
  &:hover {
    background: $color-primary;
    border-color: $color-primary;
    color: #fff;
  }
}

.network-table-wrap {
  overflow-x: auto;
  border: 1px solid $color-border;
  border-radius: 12px;
}

.network-contacts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  th {
    text-align: left;
    padding: 0.6rem 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: $color-muted;
    border-bottom: 1px solid $color-border;
    white-space: nowrap;
  }

  td {
    padding: 0.65rem 0.875rem;
    border-bottom: 1px solid $color-border;
    vertical-align: middle;

    &:last-child { border-right: none; }
  }

  tr:last-child td { border-bottom: none; }
}

.network-score-col {
  text-align: center;
  width: 56px;
}

.network-score-cell {
  display: inline-block;
  font-weight: 600;
  color: $color-text;
}

.network-score-overall {
  color: $color-primary;
  font-size: 1rem;
}

.network-person-cell {
  min-width: 180px;
}

.network-person-name {
  display: block;
  font-weight: 500;
  color: $color-text;
}

.network-person-meta {
  display: block;
  font-size: 0.775rem;
  color: $color-muted;
  margin-top: 0.1rem;
}

.network-source-cell {
  font-size: 0.775rem;
  color: $color-muted;
}

.network-status-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;

  &--pending   { background: $color-border; color: $color-muted; }
  &--sent      { background: rgba($color-success, 0.15); color: $color-success; }
  &--failed    { background: rgba($color-danger, 0.1); color: $color-danger; }
  &--skipped   { background: $color-border; color: $color-muted; }
  &--unsubscribed { background: $color-border; color: $color-muted; opacity: 0.6; }
}
```

---

## Step 5: Update `src/styles/main.scss`

Add `@import 'network'` after `@import 'score'`:

```scss
@import 'variables';
@import 'base';
@import 'layout';
@import 'components';
@import 'navigation';
@import 'widget';
@import 'modal';
@import 'score';
@import 'network';
```

---

## SCSS variables check

Before writing `.scss`, verify the exact variable names in `src/styles/_variables.scss`. Common names used across the codebase:
- `$color-text`, `$color-muted`, `$color-bg`, `$color-surface`, `$color-border`
- `$color-primary` (Signal purple `#7c3aed`)
- `$color-success`, `$color-danger`

If any of these differ, match the actual variable names from `_variables.scss`.

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/signal-contacts-get.js` | New |
| `src/network.njk` | New |
| `src/assets/js/network.js` | New |
| `src/styles/_network.scss` | New |
| `src/styles/main.scss` | Add `@import 'network'` |

---

## Do not commit
Leave all changes for review.

## Verification
1. `npm run start` — open `http://localhost:8888/network/`
2. Unauthenticated → redirects to `/signin/`
3. Authenticated → page loads with three form sections + empty contacts table
4. Run a discovery query → status updates every 3s → contacts appear in table when done
5. Paste a LinkedIn URL → contact appears in table
6. Filter tabs work: "High match (8+)" shows only score ≥ 8
7. Filter "Sent" shows contacts with `outreachStatus: 'sent'`
