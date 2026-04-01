# TICKET-7: Unified widget API layer (api.js)

## Why this exists

The widget currently makes direct `fetch()` calls scattered across 8+ modules. `src/assets/js/api.js` exists as a placeholder for a central API routing layer but is currently unused (it was only imported by the now-deleted `signal-modal.js`).

Centralizing API calls through `api.js` enables:
- Consistent error handling
- Request logging to Firestore (behavioral signal data)
- Easy baseUrl switching (local dev vs prod)
- Retry logic in one place

**Prerequisite:** TICKET-3 complete.

## Work

### Expand `api.js`

```js
// src/assets/js/api.js

export function apiUrl(baseUrl, path) {
  return `${baseUrl}${path}`;
}

export async function apiPost(baseUrl, path, body) {
  const res = await fetch(apiUrl(baseUrl, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiStream(baseUrl, path, body) {
  const res = await fetch(apiUrl(baseUrl, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;  // caller passes to readStream()
}
```

### Optional: DB logging

If behavioral signal logging is desired at the API boundary, add a non-blocking log call:
```js
// fire-and-forget: log widget API call to signal-ingest or a dedicated endpoint
```

### Widget module updates

Replace all inline `fetch()` calls in `core/eval.js`, `core/history.js`, `modes/visitor.js`, `modes/owner.js`, `modes/onboard.js`, `widget.js` with `apiPost()` / `apiStream()` from `api.js`.

### Import path

Since `api.js` is in `src/assets/js/` and the widget modules are in `src/widget/`, the import path would be `../../assets/js/api.js`. Consider moving `api.js` into `src/widget/` at that point, or symlinking.

## Acceptance criteria

- [ ] All widget `fetch()` calls go through `api.js`
- [ ] `apiUrl(baseUrl, path)` used consistently (no hardcoded origins)
- [ ] Error handling centralized (non-200 responses throw consistently)
