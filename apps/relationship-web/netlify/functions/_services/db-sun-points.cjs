/**
 * db-sun-points.cjs - Sun Points Service
 *
 * Tracks sun points earned by partners through replies.
 * Uses a singleton document for current state.
 *
 * Collection: sun-points
 * Singleton doc: "sun-current"
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'sun-points';
const SINGLETON_ID = 'sun-current';

const DEFAULT_STATE = {
  erik: 0,
  marta: 0,
  totalPoints: 0,
  todayPoints: 0,
  todayDate: null,
  lastAwarded: null,
  lastUpdated: null
};

/**
 * Get current sun points state.
 * Returns default state if singleton doesn't exist yet.
 */
async function getCurrentPoints() {
  const doc = await dbCore.get({ collection: COLLECTION, id: SINGLETON_ID });
  if (!doc) return { id: SINGLETON_ID, ...DEFAULT_STATE };
  return doc;
}

/**
 * Award points to both replier and sharer.
 * Auto-creates singleton on first write if it doesn't exist.
 * Resets todayPoints if the date has changed.
 */
async function addPoints({ replierName, sharerName, points }) {
  const current = await getCurrentPoints();
  const today = new Date().toISOString().slice(0, 10);

  // Reset daily counter if new day
  const todayPoints = current.todayDate === today ? current.todayPoints : 0;

  const replierKey = replierName.toLowerCase();
  const sharerKey = sharerName.toLowerCase();

  const data = {
    [replierKey]: (current[replierKey] || 0) + points,
    [sharerKey]: (current[sharerKey] || 0) + points,
    totalPoints: (current.totalPoints || 0) + (points * 2),
    todayPoints: todayPoints + (points * 2),
    todayDate: today,
    lastAwarded: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };

  await dbCore.create({
    collection: COLLECTION,
    id: SINGLETON_ID,
    data
  });

  return {
    awarded: points,
    todayTotal: data.todayPoints,
    totalPoints: data.totalPoints
  };
}

/**
 * Get today's total points (for weather bonus tier calculation).
 */
async function getTodayPoints() {
  const current = await getCurrentPoints();
  const today = new Date().toISOString().slice(0, 10);
  if (current.todayDate !== today) return 0;
  return current.todayPoints || 0;
}

module.exports = {
  getCurrentPoints,
  addPoints,
  getTodayPoints
};
