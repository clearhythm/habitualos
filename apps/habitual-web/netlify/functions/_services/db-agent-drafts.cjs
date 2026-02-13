//
// netlify/functions/_services/db-agent-drafts.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agent Drafts) for Firestore.
// Handles content drafts that agents produce for user review
// (companies, people, articles, etc.)
//
// Responsibilities:
//   - createDraft(data) - Create a new draft
//   - getDraftById(draftId) - Get single draft by ID
//   - getDraftsByAgent(agentId, userId, filters?) - Get drafts for an agent
//   - getDraftsByUser(userId, filters?) - Get drafts for a user across all agents
//   - getDraftsByStatus(status) - Get all drafts with a specific status
//   - getReconciledDrafts() - Get all drafts ready for reconciliation
//   - updateDraft(draftId, updates) - Update draft fields
//   - updateDraftStatus(draftId, status) - Convenience status update
//
// Schema:
//   {
//     id: "draft-abc123",
//     _userId: "u-...",
//     agentId: "agent-...",
//     type: "company",              // company | person | article | job
//     status: "pending",            // pending | reviewed | committed
//                                   // (legacy: accepted | rejected - treated as 'reviewed')
//     data: {                       // type-specific payload
//       name: "Spring Health",
//       domain: "springhealth.com",
//       ...
//     },
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
//
// Status Flow:
//   pending -> reviewed -> committed
//   User sentiment is captured in user-feedback collection, not in status.
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');
const { generateDraftId } = require('../_utils/data-utils.cjs');

/**
 * Create a new agent draft
 * @param {Object} data - Draft data (_userId, agentId, type, data)
 * @returns {Promise<Object>} Created draft with id
 */
exports.createDraft = async (data) => {
  const id = generateDraftId();

  const draftData = {
    ...data,
    status: data.status || 'pending',
    data: data.data || {}
  };

  await dbCore.create({
    collection: 'agent-drafts',
    id,
    data: draftData
  });

  return { id, ...draftData };
};

/**
 * Get a single draft by ID
 * @param {string} draftId - Draft ID
 * @returns {Promise<Object|null>} Draft document or null
 */
exports.getDraftById = async (draftId) => {
  return await dbCore.get({
    collection: 'agent-drafts',
    id: draftId
  });
};

/**
 * Get all drafts for an agent (filtered by userId)
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID for ownership check
 * @param {Object} filters - Optional filters { status?, type?, limit? }
 * @returns {Promise<Array>} Array of drafts (newest first)
 */
exports.getDraftsByAgent = async (agentId, userId, filters = {}) => {
  const whereClause = `agentId::eq::${agentId}`;

  let results = await dbCore.query({
    collection: 'agent-drafts',
    where: whereClause
  });

  // Filter by userId (security)
  results = results.filter(draft => draft._userId === userId);

  // Apply optional filters
  if (filters.status) {
    results = results.filter(draft => draft.status === filters.status);
  }
  if (filters.type) {
    results = results.filter(draft => draft.type === filters.type);
  }

  // Sort by _createdAt descending (newest first)
  results.sort((a, b) => {
    const timeA = a._createdAt?._seconds || 0;
    const timeB = b._createdAt?._seconds || 0;
    return timeB - timeA;
  });

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    results = results.slice(0, filters.limit);
  }

  return results;
};

/**
 * Get all drafts for a user across all agents
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters { status?, type?, limit? }
 * @returns {Promise<Array>} Array of drafts (newest first)
 */
exports.getDraftsByUser = async (userId, filters = {}) => {
  const whereClause = `_userId::eq::${userId}`;

  let results = await dbCore.query({
    collection: 'agent-drafts',
    where: whereClause
  });

  // Apply optional filters
  if (filters.status) {
    results = results.filter(draft => draft.status === filters.status);
  }
  if (filters.type) {
    results = results.filter(draft => draft.type === filters.type);
  }

  // Sort by _createdAt descending (newest first)
  results.sort((a, b) => {
    const timeA = a._createdAt?._seconds || 0;
    const timeB = b._createdAt?._seconds || 0;
    return timeB - timeA;
  });

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    results = results.slice(0, filters.limit);
  }

  return results;
};

/**
 * Update a draft's fields
 * @param {string} draftId - Draft ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result
 */
exports.updateDraft = async (draftId, updates) => {
  const allowedFields = ['status', 'data'];
  const safeUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new Error('No valid updates provided');
  }

  await dbCore.patch({
    collection: 'agent-drafts',
    id: draftId,
    data: safeUpdates
  });

  return { id: draftId, updated: Object.keys(safeUpdates) };
};

/**
 * Update a draft's status (convenience method)
 * @param {string} draftId - Draft ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Result
 */
exports.updateDraftStatus = async (draftId, status) => {
  return await exports.updateDraft(draftId, { status });
};

/**
 * Get all drafts with a specific status
 * @param {string} status - Status to filter by (pending, reviewed, committed)
 * @returns {Promise<Array>} Array of drafts
 */
exports.getDraftsByStatus = async (status) => {
  return await dbCore.query({
    collection: 'agent-drafts',
    where: `status::eq::${status}`
  });
};

/**
 * Get all drafts ready for reconciliation
 * Includes 'reviewed' status + legacy 'accepted'/'rejected' for backcompat
 * @returns {Promise<Array>} Array of drafts ready to be committed to filesystem
 */
exports.getReconciledDrafts = async () => {
  const [reviewed, accepted, rejected] = await Promise.all([
    exports.getDraftsByStatus('reviewed'),
    exports.getDraftsByStatus('accepted'),
    exports.getDraftsByStatus('rejected')
  ]);
  return [...reviewed, ...accepted, ...rejected];
};
