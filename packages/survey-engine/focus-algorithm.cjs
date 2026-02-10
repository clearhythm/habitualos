/**
 * Focus Algorithm
 *
 * Given all users' dimension averages for a survey, computes the 5 focus
 * dimensions: 3 lowest combined + 2 highest combined.
 *
 * Pure function — no DB access.
 */

/**
 * Compute focus dimensions from user scores.
 *
 * @param {Object} userScores - Map of userId → Map of dimension → average score
 *   e.g., { "u-erik": { "Communication": 7.0, "Trust": 3.5 }, "u-marta": { ... } }
 * @returns {{ focusDimensions: string[], combinedScores: Object }}
 */
function computeFocusDimensions(userScores) {
  const userIds = Object.keys(userScores);
  if (userIds.length === 0) {
    return { focusDimensions: [], combinedScores: {} };
  }

  // Collect all dimension names across all users
  const allDimensions = new Set();
  for (const userId of userIds) {
    for (const dim of Object.keys(userScores[userId])) {
      allDimensions.add(dim);
    }
  }

  // Compute combined average per dimension
  const combinedScores = {};
  for (const dim of allDimensions) {
    const entry = {};
    let sum = 0;
    let count = 0;

    for (const userId of userIds) {
      const score = userScores[userId][dim];
      if (score != null) {
        entry[userId] = score;
        sum += score;
        count++;
      }
    }

    entry.combined = count > 0 ? sum / count : 0;
    combinedScores[dim] = entry;
  }

  // Sort dimensions by combined score
  const sorted = Object.entries(combinedScores)
    .sort((a, b) => a[1].combined - b[1].combined);

  // Pick 3 lowest + 2 highest
  const lowest3 = sorted.slice(0, 3).map(([dim]) => dim);
  const highest2 = sorted.slice(-2).map(([dim]) => dim);

  // Deduplicate in case there are fewer than 5 unique dimensions
  const focusDimensions = [...new Set([...lowest3, ...highest2])];

  return { focusDimensions, combinedScores };
}

module.exports = { computeFocusDimensions };
