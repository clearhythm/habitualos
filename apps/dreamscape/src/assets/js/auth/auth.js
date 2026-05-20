import { log } from '../utils/log.js';

const KEY_USER_ID  = 'dp-userId';
const KEY_NAME     = 'dp-name';
const KEY_SIGNED_IN = 'dp-signed-in';

export function isSignedIn() {
  return localStorage.getItem(KEY_SIGNED_IN) === 'true';
}

export function signIn({ userId, name }) {
  localStorage.setItem(KEY_USER_ID,   userId);
  localStorage.setItem(KEY_NAME,      name || '');
  localStorage.setItem(KEY_SIGNED_IN, 'true');
  document.cookie = 'dp-auth=1; path=/; samesite=lax; max-age=31536000';
  log('debug', '[auth] signed in as', userId, name);
}

export function signOut() {
  localStorage.removeItem(KEY_USER_ID);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_SIGNED_IN);
  document.cookie = 'dp-auth=; path=/; samesite=lax; max-age=0';
  window.location.replace('/signin/');
}

export function getUserId() {
  return localStorage.getItem(KEY_USER_ID);
}

export function getName() {
  return localStorage.getItem(KEY_NAME) || '';
}

export function initGuestId() {
  let id = localStorage.getItem(KEY_USER_ID);
  if (!id) {
    id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(KEY_USER_ID, id);
  }
  return id;
}
