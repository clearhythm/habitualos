import { get, post } from '../api.js';
import { getUserId } from '../auth/auth.js';

export function getUserProfile()                  { return get(`/api/user-profile-get?userId=${encodeURIComponent(getUserId())}`); }
export function setUserProfile({ name, chime } = {}) { return post('/api/user-register', { userId: getUserId(), name, chime }); }
