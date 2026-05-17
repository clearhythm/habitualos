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
  getCircle:   ()         => adminFetch('admin-circle'),
  getSessions: ()         => adminFetch('admin-sessions'),
  seed:        (scenario) => adminFetch('admin-seed', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  }),
  reset:       ()         => adminFetch('admin-reset', { method: 'POST' }),
};
