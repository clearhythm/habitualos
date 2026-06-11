function getAdminKey() {
  return sessionStorage.getItem('dp-admin-key') || '';
}

function ensureAdminKey() {
  const stored = getAdminKey();
  if (stored) return stored;
  const entered = prompt('Enter admin key:');
  if (!entered) return null;
  sessionStorage.setItem('dp-admin-key', entered);
  return entered;
}

async function adminFetch(path, options = {}) {
  const key = ensureAdminKey();
  if (!key) throw new Error('No admin key');

  const res = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': key,
      ...(options.headers || {}),
    },
  });

  if (res.status === 403) {
    sessionStorage.removeItem('dp-admin-key');
    throw new Error('Wrong admin key — cleared, try again');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json();
}

export const AdminAPI = {
  getUsers:      ()                       => adminFetch('admin-users'),
  getSessions:   ()                       => adminFetch('admin-sessions'),
  seed:          (scenario)               => adminFetch('admin-seed', { method: 'POST', body: JSON.stringify({ scenario }) }),
  reset:         ()                       => adminFetch('admin-reset', { method: 'POST' }),
  signInAs:      (targetUserId)           => adminFetch('admin-sign-in-as', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
  testData:      (body)                   => adminFetch('admin-test-data', { method: 'POST', body: JSON.stringify(body) }),
  noteSend:      (body)                   => adminFetch('note-send', { method: 'POST', body: JSON.stringify(body) }),
  circleData:    (userId)                 => adminFetch(`circle-data?userId=${encodeURIComponent(userId)}`),
  notesUnlock:   (userId)                 => adminFetch('notes-unlock', { method: 'POST', body: JSON.stringify({ userId }) }),
  notesMarkRead: (userId, fromUserId)     => adminFetch('notes-mark-read', { method: 'POST', body: JSON.stringify({ userId, fromUserId }) }),
  getLogs:       ()                       => adminFetch('admin-logs'),
};
