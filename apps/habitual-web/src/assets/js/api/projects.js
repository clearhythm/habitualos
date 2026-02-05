//
// assets/js/api/projects.js
// ------------------------------------------------------
// FRONTEND CLIENT (browser) for project-related endpoints.
// Exposes: listProjects, getProject, getProjectDetails
// ------------------------------------------------------

import { buildUrl } from "/assets/js/utils/utils.js";
import { API_BASE_URL } from "/assets/js/utils/env-config.js";

// -----------------------------
// Keys & Constants
// -----------------------------
const API_PROJECTS_LIST = `${API_BASE_URL}/projects-list`;
const API_PROJECT_GET = `${API_BASE_URL}/project-get`;
const API_PROJECT_DETAILS = `${API_BASE_URL}/project-details`;

// -----------------------------
// CRUD ACTIONS
// -----------------------------

/**
 * List all projects for a user
 * @param {string} userId
 * @returns {Promise<{success: boolean, projects: Array, count: number}>}
 */
export async function listProjects(userId) {
  const url = buildUrl(API_PROJECTS_LIST, { userId });
  const response = await fetch(url);
  return response.json();
}

/**
 * Get a single project by ID
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<{success: boolean, project: Object}>}
 */
export async function getProject(projectId, userId) {
  const url = buildUrl(API_PROJECT_GET, { projectId, userId });
  const response = await fetch(url);
  return response.json();
}

/**
 * Get a project with rolled-up agents and actions
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<{success: boolean, project: Object, agents: Array, actions: Array}>}
 */
export async function getProjectDetails(projectId, userId) {
  const url = buildUrl(API_PROJECT_DETAILS, { projectId, userId });
  const response = await fetch(url);
  return response.json();
}
