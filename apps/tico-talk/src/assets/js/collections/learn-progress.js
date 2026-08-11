import { get, post } from '../api.js';

/**
 * getLearnProgress — a user's full coverage + last-trained pointer for one
 * restaurant. Thin GET wrapper, no caching, no derived logic (that lives in
 * utils/learn-coverage.js).
 */
export async function getLearnProgress(userId, restaurantId) {
  return get(`/api/learn-progress-get?userId=${encodeURIComponent(userId)}&restaurantId=${encodeURIComponent(restaurantId)}`);
}

/**
 * writeLearnProgress — one write endpoint for the resource. Pass
 * itemId+factType to mark a fact covered, lastTrained to set the pointer,
 * progress ('Training'|'Covered'|'Mastered', with section) to set that
 * section's canonical status, or any combination.
 */
export async function writeLearnProgress({ userId, restaurantId, section, itemId, factType, lastTrained, progress }) {
  return post('/api/learn-progress-write', { userId, restaurantId, section, itemId, factType, lastTrained, progress });
}

/**
 * resetSectionProgress — clears one section's coverage entirely (testing/
 * support utility, not a trainee-facing action). Thin POST wrapper.
 */
export async function resetSectionProgress(userId, restaurantId, section) {
  return post('/api/learn-progress-reset', { userId, restaurantId, section });
}
