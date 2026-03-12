/**
 * dashboard.js — Signal owner dashboard
 * Loads owner config, renders personas, handles saves.
 * Phase 3: adds upload flow, gap Q&A, contact links, leads.
 */

const loading = document.getElementById('dash-loading');
const main    = document.getElementById('dash-main');
const unauth  = document.getElementById('dash-unauth');

let ownerConfig = null;
let selectedFile = null;
let parsedConversations = null;
let detectedSource = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const signalId = localStorage.getItem('signal-owner-id');
  if (!signalId) { showUnauth(); return; }

  try {
    const res = await fetch('/api/signal-config-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId })
    });
    const data = await res.json();
    if (!data.success || data.config.status !== 'active') { showUnauth(); return; }
    if (data.config._userId !== window.__userId) { showUnauth(); return; }

    ownerConfig = data.config;
    renderDashboard(ownerConfig);
    loading.hidden = true;
    main.hidden = false;

    // Load context stats, leads, and evaluation history in parallel
    loadContextStatus();
    loadLeads();
    loadEvaluationHistory();
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
  const { signalId, displayName, contextText = '', personas = [], anthropicApiKey, contactLinks = {} } = config;

  document.getElementById('dash-display-name').textContent = displayName;
  document.getElementById('dash-signal-id').textContent = signalId;
  document.getElementById('dash-preview-link').href = `/widget/?id=${signalId}`;

  const snippet = `<script src="https://signal.habitualos.com/assets/js/signal-embed.js" data-signal-id="${signalId}"><\/script>`;
  document.getElementById('embed-code').textContent = snippet;

  document.getElementById('context-text').value = contextText;
  document.getElementById('apikey-hint').textContent = anthropicApiKey
    ? 'API key is saved. Enter a new value to replace it.'
    : 'No key saved yet. Without it, your widget uses the shared Signal key (rate limited).';

  // Contact links
  document.getElementById('link-calendar').value = contactLinks.calendar || '';
  document.getElementById('link-linkedin').value = contactLinks.linkedin || '';
  document.getElementById('link-substack').value = contactLinks.substack || '';
  document.getElementById('link-other').value = contactLinks.other || '';

  // Gap Q&A prefill from existing profile
  const wp = config.wantsProfile || {};
  if (wp.opportunities?.length) document.getElementById('gap-opportunities').value = wp.opportunities.join(', ');
  if (wp.excitedBy?.length) document.getElementById('gap-excited-by').value = wp.excitedBy.join(', ');
  if (wp.workStyle) document.getElementById('gap-work-style').value = wp.workStyle;
  if (wp.notLookingFor?.length) document.getElementById('gap-not-looking-for').value = wp.notLookingFor.join(', ');

  const pp = config.personalityProfile || {};
  if (pp.communicationStyle) document.getElementById('gap-collab-style').value = pp.communicationStyle;
  if (pp.problemApproach) document.getElementById('gap-problem-approach').value = pp.problemApproach;

  renderPersonas(personas);
}

// ─── Context status ───────────────────────────────────────────────────────────

async function loadContextStatus() {
  try {
    const res = await fetch('/api/signal-context-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId })
    });
    const data = await res.json();
    if (!data.success) return;
    renderContextStats(data);
  } catch {}
}

function renderContextStats(data) {
  const { stats, lastUploadAt, skillsProfile, wantsProfile, personalityProfile } = data;
  if (!stats || stats.total === 0) return;

  // Stats card
  const statsEl = document.getElementById('context-stats');
  statsEl.hidden = false;
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-processed').textContent = stats.processed;
  document.getElementById('stat-claude').textContent = stats.bySource?.claude || 0;
  document.getElementById('stat-chatgpt').textContent = stats.bySource?.chatgpt || 0;
  document.getElementById('stat-last-upload').textContent = lastUploadAt
    ? new Date(lastUploadAt).toLocaleDateString() : '—';

  // Show delete button
  document.getElementById('context-delete-btn').hidden = false;

  // Completeness
  if (skillsProfile || wantsProfile || personalityProfile) {
    document.getElementById('completeness-grid').hidden = false;
    setCompleteness('skills', skillsProfile?.completeness || 0);
    setCompleteness('alignment', wantsProfile?.completeness || 0);
    setCompleteness('personality', personalityProfile?.completeness || 0);

    // Show gap Q&A cards for weak dimensions
    if ((wantsProfile?.completeness || 0) < 0.3) document.getElementById('gap-alignment').hidden = false;
    if ((personalityProfile?.completeness || 0) < 0.3) document.getElementById('gap-personality').hidden = false;
  }
}

function setCompleteness(dim, value) {
  const pct = Math.round(value * 100);
  document.getElementById(`completeness-${dim}`).style.width = `${pct}%`;
  document.getElementById(`completeness-${dim}-pct`).textContent = `${pct}% from history`;
}

// ─── File upload ──────────────────────────────────────────────────────────────

document.getElementById('context-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('upload-label-text').textContent = file.name;
  document.getElementById('upload-label').classList.add('has-file');
  document.getElementById('context-upload-btn').disabled = true;
  document.getElementById('upload-status').textContent = 'Parsing…';

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const raw = JSON.parse(ev.target.result);
      const { source, conversations } = parseExport(raw);
      if (!conversations || conversations.length === 0) throw new Error('No conversations found');
      detectedSource = source;
      parsedConversations = conversations;
      document.getElementById('upload-status').textContent = `${conversations.length} conversations found (${source})`;
      document.getElementById('context-upload-btn').disabled = false;
    } catch (err) {
      document.getElementById('upload-status').textContent = `Could not parse file: ${err.message}`;
      document.getElementById('context-upload-btn').disabled = true;
    }
  };
  reader.readAsText(file);
});

/**
 * Auto-detect and parse Claude or ChatGPT export format.
 */
function parseExport(data) {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Expected a JSON array');

  const first = data[0];

  // Claude: has uuid + chat_messages
  if (first.uuid && first.chat_messages) {
    return {
      source: 'claude',
      conversations: data.slice(0, 500).map(conv => ({
        conversationId: conv.uuid,
        title: conv.name || 'Untitled',
        date: conv.created_at || new Date().toISOString(),
        messageCount: (conv.chat_messages || []).length,
        excerpt: (conv.chat_messages || [])
          .filter(m => m.sender === 'human')
          .map(m => String(m.text || ''))
          .join(' ')
          .slice(0, 800)
      }))
    };
  }

  // ChatGPT: has mapping + create_time
  if (first.mapping && (first.create_time !== undefined || first.id)) {
    return {
      source: 'chatgpt',
      conversations: data.slice(0, 500).map(conv => {
        const messages = Object.values(conv.mapping || {})
          .filter(n => n.message?.author?.role === 'user' && n.message?.content?.parts)
          .map(n => (n.message.content.parts || []).join(' '))
          .join(' ');
        return {
          conversationId: conv.id || conv.conversation_id,
          title: conv.title || 'Untitled',
          date: conv.create_time
            ? new Date(conv.create_time * 1000).toISOString()
            : new Date().toISOString(),
          messageCount: Object.keys(conv.mapping || {}).length,
          excerpt: messages.slice(0, 800)
        };
      }).filter(c => c.conversationId)
    };
  }

  throw new Error('Unknown format — expected Claude or ChatGPT export');
}

document.getElementById('context-upload-btn').addEventListener('click', async () => {
  if (!parsedConversations || !detectedSource) return;

  const btn = document.getElementById('context-upload-btn');
  const status = document.getElementById('upload-status');
  btn.disabled = true;
  btn.textContent = 'Uploading…';
  document.getElementById('upload-progress-wrap').hidden = false;
  setProgress(0, 'Uploading conversations…');

  try {
    // Phase A: Upload (dedup + create pending chunks)
    const uploadRes = await fetch('/api/signal-context-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: window.__userId,
        source: detectedSource,
        conversations: parsedConversations
      })
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

    if (uploadData.new === 0) {
      status.textContent = `All ${uploadData.skipped} conversations already processed.`;
      setProgress(100, 'Up to date.');
      btn.textContent = 'Upload';
      btn.disabled = false;
      loadContextStatus();
      return;
    }

    status.textContent = `${uploadData.new} new, ${uploadData.skipped} skipped. Extracting…`;

    // Phase B: Process in batches
    let remaining = uploadData.pending;
    const total = uploadData.new;
    let done = 0;

    while (remaining > 0) {
      const pct = Math.round((done / total) * 90);
      setProgress(pct, `Extracting ${done}/${total}…`);

      const processRes = await fetch('/api/signal-context-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: window.__userId, limit: 4 })
      });
      const processData = await processRes.json();
      if (!processData.success) throw new Error(processData.error || 'Processing failed');

      done += processData.processed;
      remaining = processData.remaining;
      if (processData.processed === 0 && remaining > 0) break; // safety
    }

    // Phase C: Synthesize profiles
    setProgress(95, 'Synthesizing profiles…');
    await fetch('/api/signal-context-synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId })
    });

    setProgress(100, 'Done!');
    status.textContent = `Processed ${done} new conversations.`;
    btn.textContent = 'Upload';
    btn.disabled = false;
    document.getElementById('upload-label-text').textContent = 'Choose Claude or ChatGPT export JSON';
    document.getElementById('upload-label').classList.remove('has-file');
    parsedConversations = null;
    detectedSource = null;
    selectedFile = null;

    // Refresh stats
    await loadContextStatus();

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    btn.textContent = 'Upload';
    btn.disabled = false;
  }
});

function setProgress(pct, label) {
  document.getElementById('upload-progress-fill').style.width = `${pct}%`;
  document.getElementById('upload-progress-label').textContent = label;
}

// Delete all history
document.getElementById('context-delete-btn').addEventListener('click', async () => {
  if (!confirm('Delete all uploaded conversation history? This cannot be undone.')) return;

  try {
    const res = await fetch('/api/signal-context-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('upload-status').textContent = `Deleted ${data.deleted} conversations.`;
      document.getElementById('context-stats').hidden = true;
      document.getElementById('completeness-grid').hidden = true;
      document.getElementById('context-delete-btn').hidden = true;
      document.getElementById('gap-alignment').hidden = true;
      document.getElementById('gap-personality').hidden = true;
    }
  } catch {
    document.getElementById('upload-status').textContent = 'Error deleting history.';
  }
});

// ─── Gap Q&A saves ────────────────────────────────────────────────────────────

document.getElementById('gap-alignment-save-btn').addEventListener('click', async () => {
  const opportunities = document.getElementById('gap-opportunities').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const excitedBy = document.getElementById('gap-excited-by').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const workStyle = document.getElementById('gap-work-style').value.trim();
  const notLookingFor = document.getElementById('gap-not-looking-for').value.trim().split(',').map(s => s.trim()).filter(Boolean);

  await saveField({
    wantsProfile: {
      ...(ownerConfig?.wantsProfile || {}),
      opportunities, excitedBy, workStyle, notLookingFor,
      completeness: 0.7 // manual input counts as reasonably complete
    }
  }, 'gap-alignment-status');
});

document.getElementById('gap-personality-save-btn').addEventListener('click', async () => {
  const communicationStyle = document.getElementById('gap-collab-style').value.trim();
  const problemApproach = document.getElementById('gap-problem-approach').value.trim();

  await saveField({
    personalityProfile: {
      ...(ownerConfig?.personalityProfile || {}),
      communicationStyle, problemApproach,
      completeness: 0.6
    }
  }, 'gap-personality-status');
});

// ─── Contact links ────────────────────────────────────────────────────────────

document.getElementById('links-save-btn').addEventListener('click', () => {
  saveField({
    contactLinks: {
      calendar: document.getElementById('link-calendar').value.trim(),
      linkedin: document.getElementById('link-linkedin').value.trim(),
      substack: document.getElementById('link-substack').value.trim(),
      other: document.getElementById('link-other').value.trim()
    }
  }, 'links-status');
});

// ─── Leads ────────────────────────────────────────────────────────────────────

async function loadLeads() {
  try {
    const res = await fetch('/api/signal-leads-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId })
    });
    const data = await res.json();
    if (!data.success) return;
    renderLeads(data.leads || []);
  } catch {}
}

function renderLeads(leads) {
  const list = document.getElementById('leads-list');
  const empty = document.getElementById('leads-empty');

  if (leads.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  leads.forEach(lead => {
    const score = lead.score || 0;
    const scoreClass = score >= 8 ? 'score-high' : score >= 5 ? 'score-mid' : 'score-low';
    const timeAgo = lead._createdAt ? formatTimeAgo(lead._createdAt._seconds * 1000) : '';

    const row = document.createElement('div');
    row.className = 'dash-lead-row';
    row.innerHTML = `
      <div class="dash-lead-score ${scoreClass}">${score}</div>
      <div class="dash-lead-info">
        <div class="dash-lead-name">${escHtml(lead.name || 'Anonymous')}${lead.email ? ` <span style="color:var(--color-text-muted);font-weight:400">&lt;${escHtml(lead.email)}&gt;</span>` : ''}</div>
        <div class="dash-lead-meta">${escHtml(lead.persona || '')} · ${timeAgo}</div>
        <div class="dash-lead-reason">${escHtml(lead.reason || '')}</div>
      </div>
      <div class="dash-lead-action">${escHtml(lead.nextStepLabel || '')}</div>
    `;
    list.appendChild(row);
  });
}

function formatTimeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Personas ─────────────────────────────────────────────────────────────────

function renderPersonas(personas) {
  const list = document.getElementById('personas-list');
  list.innerHTML = '';
  personas.forEach((p, i) => list.appendChild(buildPersonaRow(p, i)));
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
  row.querySelector('.dash-persona-remove').addEventListener('click', () => row.remove());
  row.querySelector('.dash-persona-label').addEventListener('input', (e) => {
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
  if (list.children.length >= 4) { alert('Maximum 4 personas.'); return; }
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

document.getElementById('context-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveField({ contextText: document.getElementById('context-text').value }, 'context-status');
});

document.getElementById('personas-save-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('.dash-persona-row');
  const personas = Array.from(rows).map(row => ({
    label: row.querySelector('.dash-persona-label').value.trim(),
    key: row.querySelector('.dash-persona-key').value.trim(),
    opener: row.querySelector('.dash-persona-opener').value.trim()
  })).filter(p => p.label && p.key && p.opener);
  if (personas.length === 0) { alert('Add at least one persona.'); return; }
  saveField({ personas }, 'personas-status');
});

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

document.getElementById('copy-embed-btn').addEventListener('click', () => {
  const code = document.getElementById('embed-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-embed-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
});

// ─── Opportunity evaluation ───────────────────────────────────────────────────

let currentEvalId = null;
let currentResumeId = null;

document.getElementById('eval-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = document.getElementById('eval-content').value.trim();
  const title = document.getElementById('eval-title').value.trim();
  if (!content) { document.getElementById('eval-status').textContent = 'Paste an opportunity first.'; return; }

  const btn = document.getElementById('eval-submit-btn');
  const status = document.getElementById('eval-status');
  btn.disabled = true;
  btn.textContent = 'Evaluating…';
  status.textContent = '';
  document.getElementById('eval-result').hidden = true;
  document.getElementById('eval-generated').hidden = true;

  try {
    const res = await fetch('/api/signal-evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: window.__userId,
        opportunity: { type: 'free-text', title: title || 'Untitled', content }
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Evaluation failed');

    currentEvalId = data.evaluationId;
    currentResumeId = null;
    renderEvalResult(data);
    loadEvaluationHistory();
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Evaluate fit →';
  }
});

function renderEvalResult(data) {
  const panel = document.getElementById('eval-result');
  const score = data.score || {};
  const overall = score.overall || 0;
  const scoreClass = overall >= 8 ? 'score-high' : overall >= 5 ? 'score-mid' : 'score-low';
  const recLabels = {
    'strong-candidate': 'Strong candidate.',
    'worth-applying': 'Worth applying.',
    'stretch': 'Stretch role.',
    'poor-fit': 'Poor fit.'
  };
  const rec = recLabels[data.recommendation] || data.recommendation || '';

  const strengthsHtml = (data.strengths || []).map(s =>
    `<li class="eval-strength-item">✓ ${escHtml(s)}</li>`
  ).join('');

  const gapsHtml = (data.gaps || []).map(g => {
    const sevClass = g.severity === 'high' ? ' eval-gap-high' : g.severity === 'moderate' ? ' eval-gap-mod' : '';
    return `<li class="eval-gap-item${sevClass}">△ ${escHtml(g.gap)}${g.closeable && g.framing ? `<span class="eval-gap-frame"> — ${escHtml(g.framing)}</span>` : ''}</li>`;
  }).join('');

  panel.innerHTML = `
    <div class="eval-score-row">
      <div class="eval-overall-score ${scoreClass}">${overall}<span class="eval-score-denom">/10</span></div>
      <div class="eval-score-dims">
        <div class="eval-score-dim">Skills <strong>${score.skills ?? '—'}</strong></div>
        <div class="eval-score-dim">Alignment <strong>${score.alignment ?? '—'}</strong></div>
      </div>
      <div class="eval-recommendation">${escHtml(rec)}</div>
    </div>
    <p class="eval-summary">${escHtml(data.summary || '')}</p>
    ${strengthsHtml || gapsHtml ? `<ul class="eval-items-list">${strengthsHtml}${gapsHtml}</ul>` : ''}
    ${data.evidenceUsed?.length ? `<div class="eval-evidence-note">Evidence: ${escHtml(data.evidenceUsed.join(' · '))}</div>` : ''}
    <div class="eval-actions">
      <button type="button" class="btn btn-ghost" id="eval-resume-btn">Generate resume →</button>
      <button type="button" class="btn btn-ghost" id="eval-cover-btn">Generate cover letter →</button>
      <span class="dash-save-status" id="eval-gen-status"></span>
    </div>
  `;

  panel.hidden = false;

  document.getElementById('eval-resume-btn').addEventListener('click', generateResume);
  document.getElementById('eval-cover-btn').addEventListener('click', generateCover);
}

async function generateResume() {
  if (!currentEvalId) return;
  const btn = document.getElementById('eval-resume-btn');
  const status = document.getElementById('eval-gen-status');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  status.textContent = '';

  try {
    const res = await fetch('/api/signal-resume-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, evaluationId: currentEvalId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Resume generation failed');

    currentResumeId = data.resumeId;
    renderGeneratedContent('eval-resume-panel', 'Resume', formatResume(data.content));
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate resume →';
  }
}

async function generateCover() {
  if (!currentEvalId) return;
  const btn = document.getElementById('eval-cover-btn');
  const status = document.getElementById('eval-gen-status');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  status.textContent = '';

  try {
    const res = await fetch('/api/signal-cover-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, evaluationId: currentEvalId, resumeId: currentResumeId || undefined })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Cover letter generation failed');

    renderGeneratedContent('eval-cover-panel', 'Cover letter', formatCoverLetter(data.content));
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate cover letter →';
  }
}

function formatResume(content) {
  if (!content) return '';
  const lines = [];
  if (content.summary) { lines.push(content.summary); lines.push(''); }
  (content.experience || []).forEach(e => {
    lines.push(`${e.title} — ${e.org}  (${e.dates})`);
    (e.bullets || []).forEach(b => lines.push(`  • ${b}`));
    lines.push('');
  });
  if (content.skills?.length) { lines.push('Skills: ' + content.skills.join(', ')); lines.push(''); }
  (content.education || []).forEach(e => {
    lines.push(`${e.degree} — ${e.institution}  (${e.dates})`);
  });
  return lines.join('\n');
}

function formatCoverLetter(content) {
  if (!content) return '';
  return String(content.body || '').replace(/\\n/g, '\n');
}

function renderGeneratedContent(panelId, label, text) {
  const panel = document.getElementById(panelId);
  panel.innerHTML = `
    <div class="eval-generated-header">
      <strong>${escHtml(label)}</strong>
      <button type="button" class="dash-copy-btn eval-copy-btn">Copy</button>
    </div>
    <pre class="eval-generated-text">${escHtml(text)}</pre>
  `;
  panel.hidden = false;
  document.getElementById('eval-generated').hidden = false;

  panel.querySelector('.eval-copy-btn').addEventListener('click', (e) => {
    navigator.clipboard.writeText(text).then(() => {
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
    });
  });
}

async function loadEvaluationHistory() {
  try {
    const res = await fetch('/api/signal-evaluations-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId })
    });
    const data = await res.json();
    if (!data.success || !data.evaluations?.length) return;
    renderEvalHistory(data.evaluations);
  } catch {}
}

function renderEvalHistory(evaluations) {
  const wrap = document.getElementById('eval-history-wrap');
  const list = document.getElementById('eval-history-list');
  list.innerHTML = '';

  evaluations.forEach(ev => {
    const overall = ev.score?.overall || 0;
    const scoreClass = overall >= 8 ? 'score-high' : overall >= 5 ? 'score-mid' : 'score-low';
    const timeAgo = ev._createdAt ? formatTimeAgo(ev._createdAt._seconds * 1000) : '';
    const tags = [ev.recommendation, ev.resumeGenerated ? 'resume' : '', ev.coverLetterGenerated ? 'cover' : ''].filter(Boolean);
    const row = document.createElement('div');
    row.className = 'eval-history-row';
    row.innerHTML = `
      <div class="dash-lead-score ${scoreClass}">${overall}</div>
      <div class="eval-history-info">
        <div class="eval-history-title-text">${escHtml(ev.title)}</div>
        <div class="dash-lead-meta">${escHtml(tags.join(' · '))}${timeAgo ? ` · ${timeAgo}` : ''}</div>
      </div>
    `;
    list.appendChild(row);
  });

  wrap.hidden = false;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
