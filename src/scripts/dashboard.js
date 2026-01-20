//
// scripts/dashboard.js
// ------------------------------------------------------
// Dashboard page module - handles agent grid and actions display
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { log } from '/assets/js/utils/log.js';
import { formatRuntime } from '/assets/js/utils/utils.js';
import { listAgents, getAgent, updateAgent } from '/assets/js/api/agents.js';
import { listActions } from '/assets/js/api/actions.js';
import { createActionCard, isMeasurementAction, handleMeasurementClick, filterActions, sortActions } from '/assets/js/components/action-card.js';
import { showActionModal } from '/assets/js/components/action-modal.js';

// -----------------------------
// State
// -----------------------------
let selectedAgentId = null;
let actionsCache = [];
let agentNameMap = {};  // agentId -> name lookup

// -----------------------------
// Dashboard Loading
// -----------------------------

/**
 * Load and display dashboard data (Multi-Agent + Actions)
 */
async function loadDashboard() {
  const loadingEl = document.querySelector('#loading-dashboard');
  const noNorthstarEl = document.querySelector('#no-northstar');
  const dashboardContentEl = document.querySelector('#dashboard-content');

  try {
    const userId = getUserId();
    log('debug', 'Loading dashboard for user:', userId);

    // Fetch all agents
    const agentsData = await listAgents(userId);

    if (!agentsData.success || !agentsData.agents || agentsData.agents.length === 0) {
      // No agents exist yet, show setup prompt
      loadingEl.style.display = 'none';
      noNorthstarEl.style.display = 'block';
      return;
    }

    // Build agent name lookup map
    agentNameMap = {};
    agentsData.agents.forEach(agent => {
      agentNameMap[agent.id] = agent.name || 'Untitled Agent';
    });

    // Fetch all actions
    const actionsData = await listActions(userId);

    if (!actionsData.success) {
      throw new Error('Failed to load actions');
    }

    // Cache actions for re-filtering
    actionsCache = actionsData.actions || [];

    // Display Agents grid
    renderAgentsGrid(agentsData.agents, actionsCache);

    // Display Actions (filtered by selected agent if applicable)
    displayActions(actionsCache, selectedAgentId);

    // Initialize dashboard controls
    initDashboardControls();

    // Show dashboard content
    loadingEl.style.display = 'none';
    dashboardContentEl.style.display = 'block';

  } catch (error) {
    log('error', 'Error loading dashboard:', error);
    loadingEl.innerHTML = '<p class="text-muted" style="color: red;">Error loading dashboard. Please refresh the page.</p>';
  }
}

// -----------------------------
// Agent Grid
// -----------------------------

/**
 * Render agents grid with all agent cards
 */
function renderAgentsGrid(agents, allActions) {
  const agentsGridEl = document.querySelector('#agents-grid');
  agentsGridEl.innerHTML = '';

  // Create agent cards
  agents.forEach(agent => {
    const agentActions = allActions.filter(a => a.agentId === agent.id);
    const card = createAgentCard(agent, agentActions);
    agentsGridEl.appendChild(card);
  });

  // Add "+ New Agent" card
  const newAgentCard = createNewAgentCard();
  agentsGridEl.appendChild(newAgentCard);
}

/**
 * Create an agent card element
 */
function createAgentCard(agent, agentActions) {
  const card = document.createElement('div');
  card.className = `agent-card ${selectedAgentId === agent.id ? 'selected' : ''} ${agent.status === 'paused' ? 'paused' : ''}`;
  card.dataset.agentId = agent.id;

  // Use agent name directly
  const displayName = agent.name || 'Untitled Agent';

  // Calculate metrics
  const completedCount = agent.metrics?.completedActions || 0;
  const totalCount = agent.metrics?.totalActions || 0;
  const totalCost = agent.metrics?.totalCost || 0;
  const projectedCost = calculateProjectedCost(agent);
  const runtime = formatRuntime(agent._createdAt);
  const model = agent.model || 'Sonnet 4.5';

  card.innerHTML = `
    <div class="agent-card-header">
      <h3 class="agent-name">${displayName}</h3>
      <span class="badge badge-${agent.status === 'active' ? 'open' : agent.status === 'paused' ? 'completed' : 'dismissed'}">${agent.status}</span>
    </div>

    <div class="agent-metrics">
      <div class="metric-row">
        <span class="metric-label">Model:</span>
        <span class="metric-value">${model}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Runtime:</span>
        <span class="metric-value">${runtime}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Cost:</span>
        <span class="metric-value">$${totalCost.toFixed(2)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Projected:</span>
        <span class="metric-value text-muted">~$${projectedCost}/mo</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Actions:</span>
        <span class="metric-value">${completedCount}/${totalCount}</span>
      </div>
    </div>

    <div class="agent-controls">
      <button class="btn btn-sm btn-ghost" data-chat-agent="${agent.id}">
        Chat
      </button>
      <button class="btn btn-sm btn-secondary" data-settings-agent="${agent.id}">
        Settings
      </button>
    </div>
  `;

  // Add click handlers
  card.querySelector(`[data-chat-agent="${agent.id}"]`).onclick = (e) => {
    e.stopPropagation();
    window.location.href = `/do/agent/?id=${agent.id}#chat`;
  };

  card.querySelector(`[data-settings-agent="${agent.id}"]`).onclick = (e) => {
    e.stopPropagation();
    window.location.href = `/do/agent/?id=${agent.id}#settings`;
  };

  // Make the whole card clickable to go to agent chat
  card.onclick = () => {
    window.location.href = `/do/agent/?id=${agent.id}#chat`;
  };

  return card;
}

/**
 * Create "+ New Agent" card
 */
function createNewAgentCard() {
  const card = document.createElement('div');
  card.className = 'agent-card new-agent-card';
  card.innerHTML = `
    <div class="new-agent-content">
      <div class="new-agent-icon">+</div>
      <h3>New Agent</h3>
      <p class="text-muted">Create a new goal</p>
    </div>
  `;
  card.onclick = () => window.location.href = '/do/setup/';
  return card;
}

/**
 * Calculate projected monthly cost based on agent's usage
 */
function calculateProjectedCost(agent) {
  const createdDate = new Date(agent._createdAt);
  const now = new Date();
  const daysSinceCreated = Math.max(1, Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)));
  const dailyAvgCost = (agent.metrics?.totalCost || 0) / daysSinceCreated;
  return (dailyAvgCost * 30).toFixed(2);
}

// -----------------------------
// Agent Actions
// -----------------------------

/**
 * Toggle agent status (pause/resume)
 */
async function toggleAgentStatus(agentId) {
  try {
    const userId = getUserId();

    // Get current agent to determine new status
    const agentData = await getAgent(agentId, userId);

    if (!agentData.success) {
      throw new Error('Failed to fetch agent');
    }

    const newStatus = agentData.agent.status === 'paused' ? 'active' : 'paused';

    // Update agent status
    const updateData = await updateAgent(agentId, userId, { status: newStatus });

    if (!updateData.success) {
      throw new Error('Failed to update agent status');
    }

    // Reload dashboard
    await loadDashboard();

  } catch (error) {
    log('error', 'Error toggling agent status:', error);
    alert('Failed to update agent status. Please try again.');
  }
}

/**
 * Filter actions view to show only selected agent's actions
 */
async function viewAgentActions(agentId) {
  selectedAgentId = agentId;

  // Highlight selected agent card
  document.querySelectorAll('.agent-card').forEach(card => {
    if (card.dataset.agentId === agentId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Show "Show All Agents" button
  const showAllBtn = document.querySelector('#show-all-agents-btn');
  showAllBtn.style.display = 'block';

  // Reload dashboard to filter actions
  await loadDashboard();
}

/**
 * Show actions from all agents (clear filter)
 */
async function showAllAgents() {
  selectedAgentId = null;

  // Remove selected class from all cards
  document.querySelectorAll('.agent-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Hide "Show All Agents" button
  const showAllBtn = document.querySelector('#show-all-agents-btn');
  showAllBtn.style.display = 'none';

  // Reload dashboard
  await loadDashboard();
}

// -----------------------------
// Actions Display
// -----------------------------

/**
 * Display action cards
 */
function displayActions(actions, filterByAgentId = null) {
  const actionsGridEl = document.querySelector('#actions-grid');
  const filterSelect = document.querySelector('#actions-filter');
  const currentFilter = filterSelect?.value || 'open';

  // Filter actions by agent if specified
  let filteredActions = actions;
  if (filterByAgentId) {
    filteredActions = actions.filter(a => a.agentId === filterByAgentId);
  }

  // Apply filter (open/all/completed)
  filteredActions = filterActions(filteredActions, currentFilter);

  // Apply sorting (blue first, then purple, each newest first)
  filteredActions = sortActions(filteredActions);

  // Clear grid
  actionsGridEl.innerHTML = '';

  // Click handler for actions
  const handleActionClick = (action) => {
    if (isMeasurementAction(action)) {
      handleMeasurementClick(action);
    } else {
      showActionModal(action, {
        agentName: agentNameMap[action.agentId],
        onComplete: () => loadDashboard()
      });
    }
  };

  // Show empty state if no actions
  if (filteredActions.length === 0) {
    actionsGridEl.innerHTML = '<div style="text-align: center; padding: 3rem 1rem; color: #6b7280; grid-column: 1 / -1;"><p style="font-size: 1.125rem; margin-bottom: 0.5rem;">No actions</p><p style="font-size: 0.875rem;">Actions will appear here when created</p></div>';
    return;
  }

  // Add all filtered and sorted actions
  filteredActions.forEach(action => {
    const card = createActionCard(action, handleActionClick);
    const isCompleted = action.state === 'completed' || action.state === 'dismissed';
    if (isCompleted) {
      card.style.opacity = '0.7';
    }
    actionsGridEl.appendChild(card);
  });
}

// -----------------------------
// Dashboard Controls
// -----------------------------

/**
 * Initialize dashboard controls (event listeners)
 */
function initDashboardControls() {
  // Show All Agents button
  const showAllBtn = document.querySelector('#show-all-agents-btn');
  if (showAllBtn) {
    showAllBtn.onclick = showAllAgents;
  }

  // Filter dropdown
  const filterSelect = document.querySelector('#actions-filter');
  if (filterSelect) {
    filterSelect.onchange = () => {
      displayActions(actionsCache, selectedAgentId);
    };
  }
}

// -----------------------------
// Page Initialization
// -----------------------------

function init() {
  log('debug', 'Initializing dashboard module');

  // Initialize user (sets hardcoded userId)
  initializeUser();

  // Load dashboard
  loadDashboard();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
