//
// assets/js/api/actions.js
// ------------------------------------------------------
// FRONTEND CLIENT (browser) for action-related endpoints.
// Exposes: listActions, getAction, completeAction, dismissAction, generateAction
// ------------------------------------------------------

import { buildUrl } from "/assets/js/utils/utils.js";
import { API_BASE_URL } from "/assets/js/utils/env-config.js";

// -----------------------------
// Keys & Constants
// -----------------------------
const API_ACTIONS_LIST = `${API_BASE_URL}/actions-list`;
const API_ACTION_GET = `${API_BASE_URL}/action-get`;
const API_ACTION_COMPLETE = `${API_BASE_URL}/action-complete`;
const API_ACTION_DISMISS = `${API_BASE_URL}/action-dismiss`;
const API_ACTION_GENERATE = `${API_BASE_URL}/action-generate`;
const API_ACTION_DEFINE = `${API_BASE_URL}/action-define`;

// -----------------------------
// CRUD ACTIONS
// -----------------------------

/**
 * List actions for a user, optionally filtered by agent
 * @param {string} userId
 * @param {string} [agentId] - Optional agent filter
 * @returns {Promise<{success: boolean, actions: Array}>}
 */
export async function listActions(userId, agentId = null) {
  const params = { userId };
  if (agentId) params.agentId = agentId;
  const url = buildUrl(API_ACTIONS_LIST, params);
  const response = await fetch(url);
  return response.json();
}

/**
 * Get a single action by ID
 * @param {string} actionId
 * @param {string} userId
 * @returns {Promise<{success: boolean, action: Object}>}
 */
export async function getAction(actionId, userId) {
  const url = `${API_ACTION_GET}/${actionId}?userId=${userId}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * Mark an action as completed
 * @param {string} actionId
 * @param {string} userId
 * @returns {Promise<{success: boolean}>}
 */
export async function completeAction(actionId, userId) {
  const url = `${API_ACTION_COMPLETE}/${actionId}?userId=${userId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return response.json();
}

/**
 * Dismiss an action
 * @param {string} actionId
 * @param {string} userId
 * @param {string} [reason] - Optional reason for dismissal
 * @returns {Promise<{success: boolean}>}
 */
export async function dismissAction(actionId, userId, reason = null) {
  const url = `${API_ACTION_DISMISS}/${actionId}?userId=${userId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: reason ? JSON.stringify({ reason }) : undefined
  });
  return response.json();
}

/**
 * Generate content for an action
 * @param {string} actionId
 * @param {string} userId
 * @param {string} type - Type of generation
 * @param {string} title - Title/prompt for generation
 * @returns {Promise<{success: boolean}>}
 */
export async function generateAction(actionId, userId, type, title) {
  const url = `${API_ACTION_GENERATE}/${actionId}?userId=${userId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title: title.trim() })
  });
  return response.json();
}

/**
 * Create a new action
 * @param {Object} data - Action data
 * @param {string} data.userId - User ID
 * @param {string} data.title - Action title
 * @param {string} [data.description] - Action description
 * @param {string} [data.agentId] - Agent ID (required if no projectId)
 * @param {string} [data.projectId] - Project ID (required if no agentId)
 * @param {string} [data.priority] - Priority: high, medium, low
 * @returns {Promise<{success: boolean, action: Object}>}
 */
export async function createAction(data) {
  const response = await fetch(API_ACTION_DEFINE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}
