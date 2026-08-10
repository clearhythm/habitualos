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
 * or both.
 */
export async function writeLearnProgress({ userId, restaurantId, section, itemId, factType, lastTrained }) {
  return post('/api/learn-progress-write', { userId, restaurantId, section, itemId, factType, lastTrained });
}
