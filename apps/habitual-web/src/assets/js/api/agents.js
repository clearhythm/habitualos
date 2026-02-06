//
// assets/js/api/agents.js
// ------------------------------------------------------
// FRONTEND CLIENT (browser) for agent-related endpoints.
// Exposes: listAgents, getAgent, updateAgentStatus
// ------------------------------------------------------

import { buildUrl } from "/assets/js/utils/utils.js";
import { API_BASE_URL } from "/assets/js/utils/env-config.js";

// -----------------------------
// Keys & Constants
// -----------------------------
const API_AGENTS_LIST = `${API_BASE_URL}/agents-list`;
const API_AGENT_GET = `${API_BASE_URL}/agent-get`;
const API_AGENT_UPDATE = `${API_BASE_URL}/agent-update`;

// -----------------------------
// CRUD ACTIONS
// -----------------------------

/**
 * List all agents for a user
 * @param {string} userId
 * @returns {Promise<{success: boolean, agents: Array}>}
 */
export async function listAgents(userId) {
  const url = buildUrl(API_AGENTS_LIST, { userId });
  const response = await fetch(url);
  return response.json();
}

/**
 * Get a single agent by ID
 * @param {string} agentId
 * @param {string} userId
 * @returns {Promise<{success: boolean, agent: Object}>}
 */
export async function getAgent(agentId, userId) {
  const url = buildUrl(API_AGENT_GET, { agentId, userId });
  const response = await fetch(url);
  return response.json();
}

/**
 * Update agent fields (e.g., status)
 * @param {string} agentId
 * @param {string} userId
 * @param {Object} fields - Fields to update (e.g., { status: 'paused' })
 * @returns {Promise<{success: boolean}>}
 */
export async function updateAgent(agentId, userId, fields) {
  const url = buildUrl(API_AGENT_UPDATE, { userId });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, ...fields })
  });
  return response.json();
}

/**
 * Toggle agent status between 'active' and 'paused'
 * @param {string} agentId
 * @param {string} userId
 * @param {string} currentStatus - Current status ('active' or 'paused')
 * @returns {Promise<{success: boolean}>}
 */
export async function toggleAgentStatus(agentId, userId, currentStatus) {
  const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
  return updateAgent(agentId, userId, { status: newStatus });
}
