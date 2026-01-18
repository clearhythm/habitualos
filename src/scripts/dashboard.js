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
import { createActionCard, isMeasurementAction, handleMeasurementClick } from '/assets/js/components/action-card.js';
import { showActionModal } from '/assets/js/components/action-modal.js';

// -----------------------------
// State
// -----------------------------
let selectedAgentId = null;

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

    // Fetch all actions
    const actionsData = await listActions(userId);

    if (!actionsData.success) {
      throw new Error('Failed to load actions');
    }

    // Display Agents grid
    renderAgentsGrid(agentsData.agents, actionsData.actions || []);

    // Display Actions (filtered by selected agent if applicable)
    displayActions(actionsData.actions || [], selectedAgentId);

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
      <button class="btn btn-sm ${agent.status === 'paused' ? 'btn-primary' : 'btn-secondary'}" data-toggle-agent="${agent.id}">
        ${agent.status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button class="btn btn-sm btn-ghost" data-view-agent="${agent.id}">
        View Details
      </button>
    </div>
  `;

  // Add click handlers
  card.querySelector(`[data-toggle-agent="${agent.id}"]`).onclick = (e) => {
    e.stopPropagation();
    toggleAgentStatus(agent.id);
  };

  card.querySelector(`[data-view-agent="${agent.id}"]`).onclick = (e) => {
    e.stopPropagation();
    window.location.href = `/do/agent/?id=${agent.id}`;
  };

  // Make the whole card clickable to go to agent detail page
  card.onclick = () => {
    window.location.href = `/do/agent/?id=${agent.id}`;
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
  const toggleBtn = document.querySelector('#toggle-completed');

  // Filter actions by agent if specified
  let filteredActions = actions;
  if (filterByAgentId) {
    filteredActions = actions.filter(a => a.agentId === filterByAgentId);
  }

  // Separate active and completed actions
  const activeActions = filteredActions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
  const completedActions = filteredActions.filter(a => a.state === 'completed' || a.state === 'dismissed');

  // Clear grid
  actionsGridEl.innerHTML = '';

  // Click handler for actions
  const handleActionClick = (action) => {
    if (isMeasurementAction(action)) {
      handleMeasurementClick(action);
    } else {
      showActionModal(action, () => loadDashboard());
    }
  };

  // Add all active actions
  activeActions.forEach(action => {
    const card = createActionCard(action, handleActionClick);
    card.dataset.cardType = 'active';
    actionsGridEl.appendChild(card);
  });

  // Add all completed actions
  completedActions.forEach(action => {
    const card = createActionCard(action, handleActionClick);
    card.dataset.cardType = 'completed';
    card.style.opacity = '0.7';
    actionsGridEl.appendChild(card);
  });

  // Update toggle button
  if (completedActions.length > 0) {
    toggleBtn.textContent = `Show Completed (${completedActions.length})`;
    toggleBtn.style.display = 'inline-block';
  }

  // Store completed count for nav.js
  window.completedActionsCount = completedActions.length;
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
