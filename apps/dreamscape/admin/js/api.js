async function adminFetch(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
  getCircle:    ()             => adminFetch('admin-circle'),
  getSessions:  ()             => adminFetch('admin-sessions'),
  seed:         (scenario)     => adminFetch('admin-seed', { method: 'POST', body: JSON.stringify({ scenario }) }),
  reset:        ()             => adminFetch('admin-reset', { method: 'POST' }),
  signInAs:     (targetUserId) => adminFetch('admin-sign-in-as', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
  // direct API calls for unit tests
  noteSend:     (body)         => adminFetch('note-send', { method: 'POST', body: JSON.stringify(body) }),
  circleData:   (userId)       => adminFetch(`circle-data?userId=${encodeURIComponent(userId)}`),
  notesUnlock:  (userId)       => adminFetch('notes-unlock', { method: 'POST', body: JSON.stringify({ userId }) }),
  notesMarkRead:(userId, fromUserId) => adminFetch('notes-mark-read', { method: 'POST', body: JSON.stringify({ userId, fromUserId }) }),
};
