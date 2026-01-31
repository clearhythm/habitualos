//
// netlify/functions/_services/db-goals.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Goals) for Firestore.
// Handles goal definitions for grouping actions within projects.
//
// Responsibilities:
//   - createGoal(id, data) - Create a new goal
//   - getGoal(goalId) - Get a single goal
//   - getGoalsByProject(projectId, userId) - Get goals for a project
//   - updateGoal(goalId, updates) - Update goal fields
//   - getGoalActions(goalId, userId) - Get actions for a goal
//   - getGoalProgress(goalId, userId) - Get progress stats
//
// Schema:
//   {
//     id: "goal-abc123",
//     _userId: "u-xyz789",
//     projectId: "project-def456",
//     title: "Launch MVP",
//     description: "Get the first version shipped",
//     state: "active" | "completed" | "archived",
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { getActionsByUserId } = require('./db-actions.cjs');

/**
 * Create a new goal
 * @param {string} id - Goal ID (with "goal-" prefix)
 * @param {Object} data - Goal data
 * @returns {Promise<Object>} Result with id
 */
exports.createGoal = async (id, data) => {
  const formattedId = id?.startsWith('goal-') ? id : `goal-${id}`;

  await dbCore.create({
    collection: 'work-goals',
    id: formattedId,
    data: {
      ...data,
      state: data.state || 'active'
    }
  });

  return { id: formattedId };
};

/**
 * Get a single goal by ID
 * @param {string} goalId - Goal ID
 * @returns {Promise<Object|null>} Goal document or null
 */
exports.getGoal = async (goalId) => {
  return await dbCore.get({ collection: 'work-goals', id: goalId });
};

/**
 * Get all goals for a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of goal documents
 */
exports.getGoalsByProject = async (projectId, userId) => {
  const results = await dbCore.query({
    collection: 'work-goals',
    where: `_userId::eq::${userId}`
  });

  // Filter by projectId and sort by created date descending
  return results
    .filter(goal => goal.projectId === projectId)
    .sort((a, b) => {
      const timeA = a._createdAt?.toMillis?.() || 0;
      const timeB = b._createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
};

/**
 * Update a goal
 * @param {string} goalId - Goal ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
exports.updateGoal = async (goalId, updates) => {
  await dbCore.patch({
    collection: 'work-goals',
    id: goalId,
    data: updates
  });
};

/**
 * Get all actions for a goal
 * @param {string} goalId - Goal ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of action documents
 */
exports.getGoalActions = async (goalId, userId) => {
  const allActions = await getActionsByUserId(userId);
  return allActions.filter(action => action.goalId === goalId);
};

/**
 * Get progress stats for a goal
 * @param {string} goalId - Goal ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} { total, completed, percentage }
 */
exports.getGoalProgress = async (goalId, userId) => {
  const actions = await exports.getGoalActions(goalId, userId);
  const total = actions.length;
  const completed = actions.filter(a => a.state === 'completed').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
};
