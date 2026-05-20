import { get } from '../api.js';
import { getUserId } from '../auth/auth.js';

const CACHE_KEY = 'dp-cache-circle';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
}

export async function getCircleData() {
  const cached = readCache();
  if (cached) return cached;
  const userId = getUserId();
  const data = await get(`/api/circle-data?userId=${encodeURIComponent(userId)}`);
  writeCache(data);
  return data;
}

export function invalidateCircleCache() {
  localStorage.removeItem(CACHE_KEY);
}
