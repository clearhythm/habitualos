//
// netlify/functions/_services/db-user-feedback.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (User Feedback) for Firestore.
// Handles structured feedback from user review sessions
// (score + narrative for agent-produced drafts).
//
// Responsibilities:
//   - createFeedback(data) - Create feedback record
//   - getFeedbackByDraft(draftId, userId) - Get feedback for a specific draft
//   - getFeedbackByAgent(agentId, userId, limit?) - Get all feedback for an agent
//
// Schema:
//   {
//     id: "feedback-abc123",
//     _userId: "u-...",
//     agentId: "agent-...",
//     draftId: "draft-...",
//     type: "company",              // matches draft type
//     score: 7,                     // 0-10, user's fit assessment
//     feedback: "Love the coaching angle...",
//     status: "accepted",           // accepted | rejected
//     user_tags: ["coaching", "right-size"],
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const { create, query } = require('@habitualos/db-core');
const { generateFeedbackId } = require('../_utils/data-utils.cjs');

/**
 * Create a new feedback record
 * @param {Object} data - Feedback data (_userId, agentId, draftId, type, score?, feedback?, status?, user_tags?)
 * @returns {Promise<Object>} Created feedback with id
 */
exports.createFeedback = async (data) => {
  const id = generateFeedbackId();

  const feedbackData = {
    ...data
  };

  await create({
    collection: 'user-feedback',
    id,
    data: feedbackData
  });

  return { id, ...feedbackData };
};

/**
 * Get feedback for a specific draft
 * @param {string} draftId - Draft ID
 * @param {string} userId - User ID for ownership check
 * @returns {Promise<Object|null>} Feedback record or null
 */
exports.getFeedbackByDraft = async (draftId, userId) => {
  const whereClause = `draftId::eq::${draftId}`;

  let results = await query({
    collection: 'user-feedback',
    where: whereClause
  });

  // Filter by userId (security)
  results = results.filter(fb => fb._userId === userId);

  return results.length > 0 ? results[0] : null;
};

/**
 * Get all feedback for an agent
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID for ownership check
 * @param {number} limit - Optional limit
 * @returns {Promise<Array>} Array of feedback (newest first)
 */
exports.getFeedbackByAgent = async (agentId, userId, limit) => {
  const whereClause = `agentId::eq::${agentId}`;

  let results = await query({
    collection: 'user-feedback',
    where: whereClause
  });

  // Filter by userId (security)
  results = results.filter(fb => fb._userId === userId);

  // Sort by _createdAt descending (newest first)
  results.sort((a, b) => {
    const timeA = a._createdAt?._seconds || 0;
    const timeB = b._createdAt?._seconds || 0;
    return timeB - timeA;
  });

  // Apply limit
  if (limit && limit > 0) {
    results = results.slice(0, limit);
  }

  return results;
};
