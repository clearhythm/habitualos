const BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8888'
  : 'https://daily.habitualos.com';

const keyInput  = document.getElementById('admin-key-input');
const keyStatus = document.getElementById('key-status');

function getAdminKey() {
  return sessionStorage.getItem('adminKey') || '';
}

keyInput.addEventListener('input', () => {
  const val = keyInput.value.trim();
  if (val) {
    sessionStorage.setItem('adminKey', val);
    keyStatus.textContent = 'set';
    keyStatus.className = 'badge bg-green-lt';
  } else {
    sessionStorage.removeItem('adminKey');
    keyStatus.textContent = 'not set';
    keyStatus.className = 'badge bg-azure-lt';
  }
});

// Restore key from session on load
const stored = getAdminKey();
if (stored) {
  keyInput.value = stored;
  keyStatus.textContent = 'set';
  keyStatus.className = 'badge bg-green-lt';
}

async function adminFetch(path, options = {}) {
  const key = getAdminKey();
  const res = await fetch(`${BASE_URL}/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json();
}

window.AdminAPI = {
  getCircle:   ()         => adminFetch('admin-circle'),
  getSessions: ()         => adminFetch('admin-sessions'),
  seed:        (scenario) => adminFetch('admin-seed', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  }),
  reset:       ()         => adminFetch('admin-reset', { method: 'POST' }),
};
