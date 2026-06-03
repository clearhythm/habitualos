import { get } from '../api.js';
import { getUserId } from '../auth/auth.js';

// No cache — V2 will use onSnapshot on /users/{userId} for live invalidation
export function getConnections() {
  return get(`/api/circle-data?userId=${encodeURIComponent(getUserId())}`);
}
