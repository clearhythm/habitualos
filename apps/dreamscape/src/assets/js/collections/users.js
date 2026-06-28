import { get, post } from '../api.js';
import { getUserId } from '../auth/auth.js';
import { log } from '../utils/log.js';

export function getUserProfile() {
  const userId = getUserId();
  log('debug', '[users] getUserProfile userId:', userId);
  return get(`/api/user-profile-get?userId=${encodeURIComponent(userId)}`)
    .then(p => { log('debug', '[users] getUserProfile result:', p); return p; });
}

export function setUserProfile({ name, chime } = {}) { return post('/api/user-register', { userId: getUserId(), name, chime }); }
