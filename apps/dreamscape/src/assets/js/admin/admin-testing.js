import { AdminAPI } from './admin-api.js';

const TEST_USERS = [
  { userId: 'u-test-erik',  name: 'Erik',  role: 'Note recipient (you)' },
  { userId: 'u-test-sarah', name: 'Sarah', role: 'Circle member, note sender' },
  { userId: 'u-test-frank', name: 'Frank', role: 'Circle member, no notes' },
  { userId: 'u-test-roi',   name: "Ro'i",  role: 'Circle member, note sender' },
];

export function initTestingView() {
  document.getElementById('test-users-table').innerHTML =
    TEST_USERS.map(u => `<tr><td><code>${u.userId}</code></td><td>${u.name}</td><td>${u.role}</td></tr>`).join('');

  const seedStatus = document.getElementById('seed-status');

  function showStatus(msg, type) {
    seedStatus.textContent = msg;
    seedStatus.className = type;
    seedStatus.hidden = false;
    setTimeout(() => { seedStatus.hidden = true; }, 5000);
  }

  const SCENARIO_LABELS = {
    'no-notes':       'A — No notes',
    'notes-waiting':  'B — Notes waiting (locked)',
    'notes-unlocked': 'C — Notes unlocked',
    'all-caught-up':  'D — All caught up',
  };

  document.querySelectorAll('.seed-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scenario = btn.dataset.scenario;
      btn.disabled = true;
      btn.textContent = 'Seeding…';
      try {
        await AdminAPI.seed(scenario);
        showStatus(`Seeded scenario: ${scenario}`, 'success');
      } catch (err) {
        showStatus(`Seed failed: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = SCENARIO_LABELS[scenario] || scenario;
      }
    });
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    const btn = document.getElementById('reset-btn');
    const names = TEST_USERS.map(u => u.name).join(', ');
    if (!confirm(`Delete all test user data for: ${names}?`)) return;
    btn.disabled = true;
    btn.textContent = 'Resetting…';
    try {
      await AdminAPI.reset();
      showStatus('Test data reset.', 'success');
    } catch (err) {
      showStatus(`Reset failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reset test data';
    }
  });
}
