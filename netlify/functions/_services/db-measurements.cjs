//
// netlify/functions/_services/db-measurements.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Measurements) for Firestore.
// Handles dimensional measurement check-ins from agents.
//
// Responsibilities:
//   - createMeasurement(id, data) - Create a new measurement record
//   - getMeasurementsByAction(actionId, userId) - Get measurements for an action
//   - getMeasurementsByAgent(agentId, userId) - Get all measurements for an agent
//   - getMeasurementsByDimension(dimension, userId, agentId) - Filter by dimension
//
// Schema:
//   {
//     id: "m-abc123",
//     _userId: "u-xyz789",
//     agentId: "agent-abc123",
//     actionId: "action-abc123",
//     timestamp: ISO string,
//     dimensions: [
//       { name: "energy", score: 7, notes: "Felt good after workout" },
//       { name: "focus", score: 5, notes: null }
//     ],
//     notes: "General observations about the whole check-in",
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Create a new measurement record
 * @param {string} id - Measurement ID (with "m-" prefix)
 * @param {Object} data - Measurement data
 * @returns {Promise<Object>} Result with id
 */
exports.createMeasurement = async (id, data) => {
  const formattedId = id?.startsWith('m-') ? id : `m-${id}`;

  await dbCore.create({
    collection: 'measurements',
    id: formattedId,
    data
  });

  return { id: formattedId };
};

/**
 * Get all measurements for a specific action
 * @param {string} actionId - Action ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of measurement documents (newest first)
 */
exports.getMeasurementsByAction = async (actionId, userId) => {
  const results = await dbCore.query({
    collection: 'measurements',
    where: `_userId::eq::${userId}`
  });

  // Filter by actionId and sort by timestamp descending
  return results
    .filter(m => m.actionId === actionId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Get all measurements for a specific agent
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of measurement documents (newest first)
 */
exports.getMeasurementsByAgent = async (agentId, userId) => {
  const results = await dbCore.query({
    collection: 'measurements',
    where: `_userId::eq::${userId}`
  });

  // Filter by agentId and sort by timestamp descending
  return results
    .filter(m => m.agentId === agentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Get measurements containing a specific dimension (for charting)
 * @param {string} dimension - Dimension name to filter by
 * @param {string} userId - User ID (for security)
 * @param {string} [agentId] - Optional agent ID filter
 * @returns {Promise<Array>} Array of measurements containing this dimension (newest first)
 */
exports.getMeasurementsByDimension = async (dimension, userId, agentId = null) => {
  const results = await dbCore.query({
    collection: 'measurements',
    where: `_userId::eq::${userId}`
  });

  // Filter by dimension name (case-insensitive)
  let filtered = results.filter(m =>
    m.dimensions?.some(d => d.name.toLowerCase() === dimension.toLowerCase())
  );

  // Optionally filter by agent
  if (agentId) {
    filtered = filtered.filter(m => m.agentId === agentId);
  }

  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};
