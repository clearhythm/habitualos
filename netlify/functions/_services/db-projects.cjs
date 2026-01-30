//
// netlify/functions/_services/db-projects.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Projects) for Firestore.
// Handles project definitions for the executive assistant system.
//
// Responsibilities:
//   - getProjectsByUserId(userId) - Get all projects for a user
//   - getProject(projectId) - Get a single project
//   - createProject(id, data) - Create a new project
//   - updateProject(projectId, updates) - Update project fields
//   - getProjectAgents(projectId, userId) - Get agents assigned to project
//   - getProjectActions(projectId, userId) - Get actions (direct + via agents)
//
// Schema:
//   {
//     id: "project-abc123",
//     _userId: "u-xyz789",
//     name: "Career Launch",
//     description: "Finding a new role in product management",
//     success_criteria: ["Land 3 interviews", "Get an offer by March"],
//     timeline: "2025-03-31" or "ongoing",
//     status: "open" | "completed" | "archived" | "deleted",
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { getAgentsByUserId } = require('./db-agents.cjs');
const { getActionsByUserId } = require('./db-actions.cjs');

/**
 * Get all projects for a specific user
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of project documents
 */
exports.getProjectsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'projects',
    where: `_userId::eq::${userId}`
  });

  // Sort by created date descending (newest first)
  return results.sort((a, b) => {
    const timeA = a._createdAt?.toMillis?.() || 0;
    const timeB = b._createdAt?.toMillis?.() || 0;
    return timeB - timeA;
  });
};

/**
 * Get a single project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Project document or null
 */
exports.getProject = async (projectId) => {
  return await dbCore.get({ collection: 'projects', id: projectId });
};

/**
 * Create a new project
 * @param {string} id - Project ID (with "project-" prefix)
 * @param {Object} data - Project data
 * @returns {Promise<Object>} Result with id
 */
exports.createProject = async (id, data) => {
  const formattedId = id?.startsWith('project-') ? id : `project-${id}`;

  await dbCore.create({
    collection: 'projects',
    id: formattedId,
    data: {
      ...data,
      status: data.status || 'open'
    }
  });

  return { id: formattedId };
};

/**
 * Update a project
 * @param {string} projectId - Project ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
exports.updateProject = async (projectId, updates) => {
  await dbCore.patch({
    collection: 'projects',
    id: projectId,
    data: updates
  });
};

/**
 * Get project count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of projects
 */
exports.getProjectCount = async (userId) => {
  const projects = await exports.getProjectsByUserId(userId);
  return projects.length;
};

/**
 * Get all agents assigned to a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of agent documents
 */
exports.getProjectAgents = async (projectId, userId) => {
  const allAgents = await getAgentsByUserId(userId);
  return allAgents.filter(agent => agent.projectId === projectId);
};

/**
 * Get all actions for a project (direct assignment + via agent inheritance)
 * An action belongs to a project if:
 * - action.projectId matches the project, OR
 * - action.agentId points to an agent whose projectId matches
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of action documents
 */
exports.getProjectActions = async (projectId, userId) => {
  // Get project's agents first
  const projectAgents = await exports.getProjectAgents(projectId, userId);
  const projectAgentIds = new Set(projectAgents.map(a => a.id));

  // Get all user actions and filter
  const allActions = await getActionsByUserId(userId);
  return allActions.filter(action =>
    action.projectId === projectId ||  // Direct assignment
    projectAgentIds.has(action.agentId) // Agent belongs to project
  );
};
