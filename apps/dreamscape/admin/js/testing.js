const seedStatus = document.getElementById('seed-status');

function showStatus(msg, type) {
  seedStatus.textContent = msg;
  seedStatus.className = type;
  seedStatus.hidden = false;
  setTimeout(() => { seedStatus.hidden = true; }, 5000);
}

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
      btn.textContent = btn.dataset.label || btn.textContent.replace('Seeding…', scenario);
      // Restore original label
      const labels = {
        'no-notes':       'A — No notes',
        'notes-waiting':  'B — Notes waiting (locked)',
        'notes-unlocked': 'C — Notes unlocked',
        'all-caught-up':  'D — All caught up',
      };
      btn.textContent = labels[scenario] || scenario;
    }
  });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  const btn = document.getElementById('reset-btn');
  if (!confirm('Delete all test user data (u-test-alice, u-test-bob, u-test-carol)?')) return;
  btn.disabled = true;
  btn.textContent = 'Resetting…';
  try {
    await AdminAPI.reset();
    showStatus('Test data reset.', 'success');
    loadCircle();
    loadSessions();
  } catch (err) {
    showStatus(`Reset failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset test data';
  }
});
