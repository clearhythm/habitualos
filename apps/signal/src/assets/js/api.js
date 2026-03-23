import { API_BASE_URL } from './env-config.js';

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
