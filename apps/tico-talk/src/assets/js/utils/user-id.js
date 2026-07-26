import { generateUserId } from '@habitualos/frontend-utils/utils.js';

const STORAGE_KEY = 'tico-user-id';

export function getOrCreateUserId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUserId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — generate a
    // session-only id rather than fail the request entirely.
    return generateUserId();
  }
}
