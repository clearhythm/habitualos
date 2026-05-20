import { get, post } from '../api.js';
import { getUserId } from '../auth/auth.js';

export const sendNote    = (data) => post('/api/note-send', data);
export const markRead    = (data) => post('/api/notes-mark-read', data);
export const checkUnread = ()     => get(`/api/unread-check?userId=${encodeURIComponent(getUserId())}`);
