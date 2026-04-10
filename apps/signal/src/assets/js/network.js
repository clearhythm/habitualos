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
