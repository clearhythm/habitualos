export async function createDraft(data) {
  const response = await fetch('/api/agent-drafts-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function listDrafts(userId, agentId, filters = {}) {
  const response = await fetch('/api/agent-drafts-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentId, ...filters })
  });
  return response.json();
}
