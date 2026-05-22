import { get, post } from '../api.js';
import { getUserId } from '../auth/auth.js';

export function fetchProfile()                    { return get(`/api/user-profile-get?userId=${encodeURIComponent(getUserId())}`); }
export function saveProfile({ name, chime } = {}) { return post('/api/user-register', { userId: getUserId(), name, chime }); }
