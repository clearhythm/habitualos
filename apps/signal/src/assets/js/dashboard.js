/**
 * dashboard.js — Signal owner dashboard
 * Loads owner config, renders personas, handles saves.
 */

const loading   = document.getElementById('dash-loading');
const main      = document.getElementById('dash-main');
const unauth    = document.getElementById('dash-unauth');

let ownerConfig = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const signalId = localStorage.getItem('signal-owner-id');

  if (!signalId) {
    showUnauth();
    return;
  }

  try {
    const res = await fetch('/api/signal-config-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId })
    });
    const data = await res.json();

    if (!data.success || data.config.status !== 'active') {
      showUnauth();
      return;
    }

    // Verify ownership (userId must match)
    if (data.config._userId !== window.__userId) {
      showUnauth();
      return;
    }

    ownerConfig = data.config;
    renderDashboard(ownerConfig);
    loading.hidden = true;
    main.hidden = false;

  } catch {
    showUnauth();
  }
})();

function showUnauth() {
  loading.hidden = true;
  unauth.hidden = false;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderDashboard(config) {
  const { signalId, displayName, contextText = '', personas = [], anthropicApiKey } = config;

  document.getElementById('dash-display-name').textContent = displayName;
  document.getElementById('dash-signal-id').textContent = signalId;
  document.getElementById('dash-preview-link').href = `/widget/?id=${signalId}`;

  // Embed code
  const snippet = `<script src="https://signal.habitualos.com/assets/js/signal-embed.js" data-signal-id="${signalId}"><\/script>`;
  document.getElementById('embed-code').textContent = snippet;

  // Context text
  document.getElementById('context-text').value = contextText;

  // API key hint
  document.getElementById('apikey-hint').textContent = anthropicApiKey
    ? 'API key is saved. Enter a new value to replace it.'
    : 'No key saved yet. Without it, your widget uses the shared Signal key (rate limited).';

  // Personas
  renderPersonas(personas);
}

// ─── Personas ────────────────────────────────────────────────────────────────

function renderPersonas(personas) {
  const list = document.getElementById('personas-list');
  list.innerHTML = '';
  personas.forEach((p, i) => {
    list.appendChild(buildPersonaRow(p, i));
  });
}

function buildPersonaRow(persona, index) {
  const row = document.createElement('div');
  row.className = 'dash-persona-row';
  row.dataset.index = index;
  row.innerHTML = `
    <div class="dash-persona-fields">
      <input class="signal-input-field dash-persona-label" type="text"
        placeholder="Label (e.g. Recruiter)" value="${escHtml(persona.label)}" maxlength="64" />
      <input class="signal-input-field dash-persona-key" type="text"
        placeholder="Key (e.g. recruiter)" value="${escHtml(persona.key)}" maxlength="32" />
      <textarea class="signal-input-field dash-persona-opener" rows="2"
        placeholder="Opening message…" maxlength="500">${escHtml(persona.opener)}</textarea>
    </div>
    <button type="button" class="dash-persona-remove" aria-label="Remove persona">×</button>
  `;
  row.querySelector('.dash-persona-remove').addEventListener('click', () => {
    row.remove();
  });
  row.querySelector('.dash-persona-label').addEventListener('input', (e) => {
    // Auto-fill key from label if key is empty or matches old label
    const keyInput = row.querySelector('.dash-persona-key');
    if (!keyInput.dataset.manuallyEdited) {
      keyInput.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  });
  row.querySelector('.dash-persona-key').addEventListener('input', (e) => {
    e.target.dataset.manuallyEdited = '1';
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  });
  return row;
}

document.getElementById('add-persona-btn').addEventListener('click', () => {
  const list = document.getElementById('personas-list');
  if (list.children.length >= 4) {
    alert('Maximum 4 personas.');
    return;
  }
  list.appendChild(buildPersonaRow({ key: '', label: '', opener: '' }, list.children.length));
});

// ─── Save handlers ────────────────────────────────────────────────────────────

async function saveField(patch, statusId) {
  const status = document.getElementById(statusId);
  status.textContent = 'Saving…';

  try {
    const res = await fetch('/api/signal-config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, patch })
    });
    const data = await res.json();
    status.textContent = data.success ? 'Saved.' : (data.error || 'Error saving.');
  } catch {
    status.textContent = 'Network error.';
  }

  setTimeout(() => { status.textContent = ''; }, 3000);
}

// Context
document.getElementById('context-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveField({ contextText: document.getElementById('context-text').value }, 'context-status');
});

// Personas
document.getElementById('personas-save-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('.dash-persona-row');
  const personas = Array.from(rows).map(row => ({
    label: row.querySelector('.dash-persona-label').value.trim(),
    key: row.querySelector('.dash-persona-key').value.trim(),
    opener: row.querySelector('.dash-persona-opener').value.trim()
  })).filter(p => p.label && p.key && p.opener);

  if (personas.length === 0) {
    alert('Add at least one persona.');
    return;
  }
  saveField({ personas }, 'personas-status');
});

// API key
document.getElementById('apikey-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = document.getElementById('apikey-input').value.trim();
  if (key && !key.startsWith('sk-ant-')) {
    document.getElementById('apikey-status').textContent = 'Anthropic API keys start with sk-ant-';
    return;
  }
  saveField({ anthropicApiKey: key }, 'apikey-status');
  document.getElementById('apikey-input').value = '';
  document.getElementById('apikey-hint').textContent = 'API key is saved. Enter a new value to replace it.';
});

// ─── Copy embed ───────────────────────────────────────────────────────────────

document.getElementById('copy-embed-btn').addEventListener('click', () => {
  const code = document.getElementById('embed-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-embed-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
