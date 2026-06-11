import { AdminAPI } from './admin-api.js';

export function initTestDataView() {
  function tdStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--tblr-danger)' : 'var(--tblr-success)';
    setTimeout(() => { el.textContent = ''; }, 5000);
  }

  function populateTuDropdown(id, users, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      users.map(u => `<option value="${u.userId}">${u.userId}${u.name ? ' — ' + u.name : ''}</option>`).join('');
    if (prev && users.some(u => u.userId === prev)) sel.value = prev;
  }

  function activeUserId() {
    return document.getElementById('test-user-select')?.value || '';
  }

  async function loadTuUsers() {
    try {
      const { members } = await AdminAPI.getUsers();
      const tuUsers = (members || []).filter(u => u.userId?.startsWith('tu-'));
      populateTuDropdown('test-user-select', tuUsers, '— select active user —');
      populateTuDropdown('connect-target-select', tuUsers, '— select target —');
    } catch (err) {
      tdStatus('create-user-status', err.message, true);
    }
  }

  document.getElementById('create-user-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('new-user-name').value.trim();
    if (!name) return;
    try {
      const { userId } = await AdminAPI.testData({ action: 'create-user', name });
      tdStatus('create-user-status', `Created ${userId}`);
      document.getElementById('new-user-name').value = '';
      await loadTuUsers();
    } catch (err) {
      tdStatus('create-user-status', err.message, true);
    }
  });

  document.getElementById('refresh-tu-btn')?.addEventListener('click', loadTuUsers);

  document.getElementById('sign-in-as-btn')?.addEventListener('click', async () => {
    const userId = activeUserId();
    if (!userId) return;
    try {
      const { token } = await AdminAPI.signInAs(userId);
      window.open(`https://daily.habitualos.com/?su=${token}`, '_blank');
    } catch (err) {
      tdStatus('create-user-status', err.message, true);
    }
  });

  document.getElementById('create-practice-btn')?.addEventListener('click', async () => {
    const userId = activeUserId();
    if (!userId) { tdStatus('practice-status', 'Select a user first', true); return; }
    try {
      const { practiceLogId } = await AdminAPI.testData({ action: 'create-practice', userId });
      tdStatus('practice-status', `Created ${practiceLogId}`);
    } catch (err) {
      tdStatus('practice-status', err.message, true);
    }
  });

  document.getElementById('delete-practices-btn')?.addEventListener('click', async () => {
    const userId = activeUserId();
    if (!userId) { tdStatus('practice-status', 'Select a user first', true); return; }
    try {
      await AdminAPI.testData({ action: 'delete-practices', userId });
      tdStatus('practice-status', `Deleted all practices for ${userId}`);
    } catch (err) {
      tdStatus('practice-status', err.message, true);
    }
  });

  document.getElementById('connect-btn')?.addEventListener('click', async () => {
    const userId = activeUserId();
    const targetUserId = document.getElementById('connect-target-select')?.value;
    if (!userId || !targetUserId) { tdStatus('connect-status', 'Select both users', true); return; }
    if (userId === targetUserId) { tdStatus('connect-status', 'Cannot connect to self', true); return; }
    try {
      await AdminAPI.testData({ action: 'connect', userId, targetUserId });
      tdStatus('connect-status', `Connected ${userId} ↔ ${targetUserId}`);
    } catch (err) {
      tdStatus('connect-status', err.message, true);
    }
  });

  document.getElementById('delete-user-btn')?.addEventListener('click', async () => {
    const userId = activeUserId();
    if (!userId) { tdStatus('danger-status', 'Select a user first', true); return; }
    if (!confirm(`Delete ${userId} and all their data?`)) return;
    try {
      await AdminAPI.testData({ action: 'delete-user', userId });
      tdStatus('danger-status', `Deleted ${userId}`);
      await loadTuUsers();
    } catch (err) {
      tdStatus('danger-status', err.message, true);
    }
  });

  document.getElementById('nuke-all-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete ALL tu-* test users and their data?')) return;
    try {
      const { deletedFor } = await AdminAPI.reset();
      tdStatus('danger-status', `Nuked: ${(deletedFor || []).join(', ') || 'none found'}`);
      await loadTuUsers();
    } catch (err) {
      tdStatus('danger-status', err.message, true);
    }
  });

  loadTuUsers();
}
