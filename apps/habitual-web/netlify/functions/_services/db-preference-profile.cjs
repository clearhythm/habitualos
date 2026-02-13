//
// netlify/functions/_services/db-preference-profile.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Preference Profiles) for Firestore.
// Stores structured preference profiles that evolve with user feedback.
// One profile per discovery agent — summarizes what the user likes/dislikes.
//
// Responsibilities:
//   - getProfile(agentId) - Get preference profile for an agent
//   - saveProfile(agentId, userId, profileData) - Create or update profile
//
// Schema:
//   {
//     id: "pref-{agentId}",
//     _userId: "u-...",
//     agentId: "agent-...",
//     profile: {
//       summary: "Looking for early-stage health/wellness companies...",
//       likes: ["mission-driven", "coaching/wellness"],
//       dislikes: ["adtech", "crypto"],
//       dealBreakers: ["fully onsite", "pre-revenue"],
//       patterns: "Consistently scores coaching companies 8+..."
//     },
//     reviewCount: 15,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

/**
 * Get preference profile for an agent
 * @param {string} agentId - Discovery agent ID
 * @returns {Promise<Object|null>} Profile document or null
 */
exports.getProfile = async (agentId) => {
  const id = `pref-${agentId}`;
  return await dbCore.get({ collection: 'preference-profiles', id });
};

/**
 * Create or update a preference profile
 * @param {string} agentId - Discovery agent ID
 * @param {string} userId - User ID
 * @param {Object} profileData - { profile, reviewCount }
 * @returns {Promise<Object>} Result with id
 */
exports.saveProfile = async (agentId, userId, profileData) => {
  const id = `pref-${agentId}`;

  const data = {
    _userId: userId,
    agentId: agentId,
    profile: profileData.profile,
    reviewCount: profileData.reviewCount || 0
  };

  // Use create which overwrites if exists (upsert behavior)
  await dbCore.create({
    collection: 'preference-profiles',
    id,
    data
  });

  return { id, ...data };
};
