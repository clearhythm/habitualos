// HabitualOS Client-Side JavaScript
// Handles dynamic data loading, chat interface, form submissions, and UI interactions

// Import auth utilities to use same hardcoded userId as practice side
import { initializeUser, getUserId } from '/assets/js/auth/auth.js';

// Initialize user on page load (sets hardcoded userId)
initializeUser();

// ============================================================================
// Dashboard Data Loading
// ============================================================================

// Global state for agent filtering
let selectedAgentId = null;

/**
 * Load and display dashboard data (Multi-Agent + Actions)
 */
async function loadDashboard() {
  const loadingEl = document.querySelector('#loading-dashboard');
  const noNorthstarEl = document.querySelector('#no-northstar');
  const dashboardContentEl = document.querySelector('#dashboard-content');

  try {
    const userId = getUserId();

    // Fetch all agents
    const agentsResponse = await fetch(`/.netlify/functions/agents-list?userId=${userId}`);
    const agentsData = await agentsResponse.json();

    if (!agentsData.success || !agentsData.agents || agentsData.agents.length === 0) {
      // No agents exist yet, show setup prompt
      loadingEl.style.display = 'none';
      noNorthstarEl.style.display = 'block';
      return;
    }

    // Fetch all actions
    const actionsResponse = await fetch(`/.netlify/functions/actions-list?userId=${userId}`);
    const actionsData = await actionsResponse.json();

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
    console.error('Error loading dashboard:', error);
    loadingEl.innerHTML = '<p class="text-muted" style="color: red;">Error loading dashboard. Please refresh the page.</p>';
  }
}

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
      <button class="btn btn-sm ${agent.status === 'paused' ? 'btn-primary' : 'btn-secondary'}" onclick="event.stopPropagation(); toggleAgentStatus('${agent.id}')">
        ${agent.status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); window.location.href='/do/agent/?id=${agent.id}'">
        View Details
      </button>
    </div>
  `;

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

/**
 * Format runtime as "X days ago" or "X hours ago"
 */
function formatRuntime(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  if (diffMinutes > 0) return `${diffMinutes} min`;
  return 'Just now';
}

/**
 * Toggle agent status (pause/resume)
 */
async function toggleAgentStatus(agentId) {
  try {
    const userId = getUserId();

    // Get current agent to determine new status
    const agentResponse = await fetch(`/.netlify/functions/agent-get?userId=${userId}&agentId=${agentId}`);
    const agentData = await agentResponse.json();

    if (!agentData.success) {
      throw new Error('Failed to fetch agent');
    }

    const newStatus = agentData.agent.status === 'paused' ? 'active' : 'paused';

    // Update agent status
    const updateResponse = await fetch(`/.netlify/functions/agent-update?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, status: newStatus })
    });

    const updateData = await updateResponse.json();

    if (!updateData.success) {
      throw new Error('Failed to update agent status');
    }

    // Reload dashboard
    await loadDashboard();

  } catch (error) {
    console.error('Error toggling agent status:', error);
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

/**
 * Display action cards and calculate progress
 */
function displayActions(actions, filterByAgentId = null) {
  const actionsGridEl = document.querySelector('#actions-grid');
  const toggleBtn = document.querySelector('#toggle-completed');

  // Filter actions by agent if specified
  let filteredActions = actions;
  if (filterByAgentId) {
    filteredActions = actions.filter(a => a.agentId === filterByAgentId);
  }

  // Filter out scheduled actions from paused agents
  filteredActions = filteredActions.filter(action => {
    // Find the agent for this action
    const agentId = action.agentId;
    if (!agentId) return true; // Include if no agent

    // Check if agent is paused (would need to fetch agent status, for now assume active)
    // This will be handled by backend filtering in future iteration
    return true;
  });

  // Separate active and completed actions
  const activeActions = filteredActions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
  const completedActions = filteredActions.filter(a => a.state === 'completed' || a.state === 'dismissed');

  // Clear grid
  actionsGridEl.innerHTML = '';

  // Add all active actions
  activeActions.forEach(action => {
    const card = createActionCard(action);
    card.dataset.cardType = 'active';
    actionsGridEl.appendChild(card);
  });

  // Add all completed actions
  completedActions.forEach(action => {
    const card = createActionCard(action);
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

/**
 * Create an action card element
 */
function createActionCard(action) {
  const card = document.createElement('a');
  card.href = `/do/action/${action.id}`;
  card.className = 'card card-clickable';
  card.style.textDecoration = 'none';

  const priorityBadge = `<span class="badge badge-${action.priority}">${capitalize(action.priority)}</span>`;

  // Show "Scheduled" with time for scheduled tasks
  let stateBadge;
  if (action.taskType === 'scheduled' && action.state === 'open' && action.scheduleTime) {
    const scheduledTime = formatDate(action.scheduleTime);
    stateBadge = `<span class="badge badge-scheduled">Scheduled: ${scheduledTime}</span>`;
  } else {
    stateBadge = `<span class="badge badge-${action.state}">${formatState(action.state)}</span>`;
  }

  card.innerHTML = `
    <div class="flex flex-between">
      <h3 class="card-title">${escapeHtml(action.title)}</h3>
      ${priorityBadge}
    </div>
    <p class="text-muted mb-sm">${escapeHtml(action.description || '')}</p>
    <div class="card-meta">
      ${stateBadge}
      <span>&rarr;</span>
    </div>
  `;

  return card;
}

/**
 * Display progress metrics
 */
function displayProgress(actions) {
  const completedCount = actions.filter(a => a.state === 'completed').length;
  const inProgressCount = actions.filter(a => a.state === 'in_progress').length;
  const openCount = actions.filter(a => a.state === 'open').length;
  const total = actions.length;

  const progressText = document.querySelector('#progress-text');
  const progressBar = document.querySelector('#progress-bar');

  let parts = [];
  if (completedCount > 0) parts.push(`<strong>${completedCount} completed</strong>`);
  if (inProgressCount > 0) parts.push(`<strong>${inProgressCount} in progress</strong>`);
  if (openCount > 0) parts.push(`<strong>${openCount} open</strong>`);

  progressText.innerHTML = `Progress: ${parts.join(', ') || 'No actions yet'}`;

  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  progressBar.style.width = `${percentage}%`;
}

// ============================================================================
// Action Detail Page Data Loading
// ============================================================================

/**
 * Load and display action detail page
 */
async function loadActionDetail() {
  const loadingEl = document.querySelector('#loading-action');
  const errorEl = document.querySelector('#action-error');
  const contentEl = document.querySelector('#action-content');

  const actionId = getActionIdFromUrl();

  if (!actionId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const userId = getUserId();
    const response = await fetch(`/.netlify/functions/action-get/${actionId}?userId=${userId}`);
    const data = await response.json();

    if (!data.success || !data.action) {
      throw new Error('Action not found');
    }

    // Display action details
    displayActionDetail(data.action, data.chat || [], data.artifacts || []);

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Store action ID for form submissions
    window.currentActionId = actionId;

  } catch (error) {
    console.error('Error loading action:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

/**
 * Load and display a markdown file
 */
async function loadFileView() {
  const loadingEl = document.querySelector('#loading-file');
  const errorEl = document.querySelector('#file-error');
  const contentEl = document.querySelector('#file-content');

  // Extract actionId and filename from URL: /do/file/:actionId/:filename
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const actionId = pathParts[2];
  const filename = pathParts[3];

  if (!actionId || !filename) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const response = await fetch(`/api/file-view/${actionId}/${filename}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'File not found');
    }

    // Display file info
    document.querySelector('#file-title').textContent = data.filename;
    document.querySelector('#file-meta').textContent = `Modified: ${formatDate(data.modified)} • Size: ${formatFileSize(data.size)}`;

    // Setup back link
    const backLink = document.querySelector('#back-to-task');
    backLink.textContent = data.actionTitle;
    backLink.href = `/do/action/${actionId}`;

    // Update breadcrumb with context
    updateBreadcrumb([
      { label: 'Dashboard', url: '/do/' },
      { label: data.actionTitle, url: `/do/action/${actionId}` },
      { label: data.filename, url: '#' }
    ]);

    // Render markdown using marked library
    const markdownContent = document.querySelector('#markdown-content');
    if (typeof marked !== 'undefined') {
      markdownContent.innerHTML = marked.parse(data.content);
    } else {
      // Fallback if marked library not loaded
      markdownContent.innerHTML = `<pre>${escapeHtml(data.content)}</pre>`;
    }

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

  } catch (error) {
    console.error('Error loading file:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

/**
 * Display action detail data
 */
function displayActionDetail(action, chatHistory, artifacts) {
  // Display action header
  document.querySelector('#action-title').textContent = action.title;

  const badgesEl = document.querySelector('#action-badges');
  badgesEl.innerHTML = `
    <span class="badge badge-${action.priority}">${capitalize(action.priority)} Priority</span>
    <span class="badge badge-${action.state}">${formatState(action.state)}</span>
  `;

  // Display description
  document.querySelector('#action-description').textContent = action.description || 'No description available.';

  // Check if this is a scheduled task
  const isScheduledTask = action.task_type === 'scheduled';

  if (isScheduledTask) {
    // Show scheduled task details, hide interactive task details
    document.querySelector('#scheduled-task-details').style.display = 'block';
    document.querySelector('#interactive-task-details').style.display = 'none';

    // Display scheduled task info
    displayScheduledTaskInfo(action);
  } else {
    // Show interactive task details, hide scheduled task details
    document.querySelector('#scheduled-task-details').style.display = 'none';
    document.querySelector('#interactive-task-details').style.display = 'block';

    // Display chat history
    const chatMessagesEl = document.querySelector('#chat-messages');
    chatMessagesEl.innerHTML = '';

    if (chatHistory.length === 0) {
      chatMessagesEl.innerHTML = '<p class="text-muted">No messages yet. Start a conversation!</p>';
    } else {
      chatHistory.forEach(msg => {
        appendMessage(msg.role, msg.content, false);
      });
    }

    // Display artifacts
    displayArtifacts(artifacts);
  }
}

/**
 * Display scheduled task information (inputs, outputs, schedule)
 */
function displayScheduledTaskInfo(action) {
  const config = action.task_config ? JSON.parse(action.task_config) : null;

  // Display schedule time
  if (action.schedule_time) {
    document.querySelector('#schedule-time').textContent = formatDate(action.schedule_time);
  }

  // Display input files
  const inputFilesEl = document.querySelector('#input-files-list');
  if (config && config.inputs_path) {
    inputFilesEl.innerHTML = `
      <p><strong>Location:</strong> ${config.inputs_path}</p>
      <p class="text-muted">context.md + user JSON files</p>
    `;
  } else {
    inputFilesEl.innerHTML = '<p>No input configuration available.</p>';
  }

  // Display output files
  const outputFilesEl = document.querySelector('#output-files-list');
  const noOutputsEl = document.querySelector('#no-outputs');

  if (action.state === 'completed') {
    // Fetch and display output files
    fetchOutputFiles(action.id, outputFilesEl, noOutputsEl);
  } else {
    outputFilesEl.style.display = 'none';
    noOutputsEl.style.display = 'block';
  }

  // Setup "Run Now" button (basic implementation - could enhance with API endpoint)
  const runNowBtn = document.querySelector('#run-now-btn');
  if (action.state === 'open') {
    runNowBtn.style.display = 'block';
    runNowBtn.onclick = () => {
      alert('To run this task now, use: node -e "require(\'./scheduler/task-executor\')(\'' + action.id + '\').catch(console.error);"');
    };
  } else {
    runNowBtn.style.display = 'none';
  }
}

/**
 * Fetch and display output files for a scheduled task
 */
async function fetchOutputFiles(actionId, outputFilesEl, noOutputsEl) {
  try {
    const response = await fetch(`/api/task-outputs/${actionId}`);
    const data = await response.json();

    if (!data.success || !data.files || data.files.length === 0) {
      outputFilesEl.style.display = 'none';
      noOutputsEl.style.display = 'block';
      return;
    }

    // Display file list with links
    outputFilesEl.innerHTML = '<ul class="file-list">' +
      data.files.map(file => `
        <li class="file-item">
          <a href="/do/file/${actionId}/${file.filename}" class="file-link">
            📄 ${escapeHtml(file.filename)}
          </a>
          <span class="file-meta">(${formatFileSize(file.size)})</span>
        </li>
      `).join('') +
      '</ul>';
    outputFilesEl.style.display = 'block';
    noOutputsEl.style.display = 'none';

  } catch (error) {
    console.error('Error fetching output files:', error);
    outputFilesEl.innerHTML = '<p class="text-muted">Error loading output files.</p>';
    outputFilesEl.style.display = 'block';
    noOutputsEl.style.display = 'none';
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Display artifacts list
 */
function displayArtifacts(artifacts) {
  const artifactListEl = document.querySelector('#artifact-list');
  const noArtifactsEl = document.querySelector('#no-artifacts');

  artifactListEl.innerHTML = '';

  if (artifacts.length === 0) {
    noArtifactsEl.style.display = 'block';
    return;
  }

  noArtifactsEl.style.display = 'none';

  artifacts.forEach(artifact => {
    const artifactEl = document.createElement('div');
    artifactEl.className = 'artifact-item';

    const icon = getArtifactIcon(artifact.type);
    const created = formatDate(artifact.created_at);

    artifactEl.innerHTML = `
      <div class="artifact-info">
        <span class="artifact-icon">${icon}</span>
        <div>
          <div class="artifact-title">${escapeHtml(artifact.title)}</div>
          <div class="artifact-meta">Created ${created}</div>
        </div>
      </div>
      <div class="artifact-actions">
        <button class="btn btn-secondary" onclick="viewArtifact('${artifact.id}')">View</button>
      </div>
    `;

    artifactListEl.appendChild(artifactEl);
  });
}

/**
 * View artifact content in alert (for now - can enhance later)
 */
window.viewArtifact = async function(artifactId) {
  try {
    const actionId = window.currentActionId;
    const userId = getUserId();
    const response = await fetch(`/.netlify/functions/action-get/${actionId}?userId=${userId}`);
    const data = await response.json();

    if (data.success && data.artifacts) {
      const artifact = data.artifacts.find(a => a.id === artifactId);
      if (artifact) {
        // For now, show in alert. Could enhance with modal later
        alert(`${artifact.title}\n\n${artifact.content}`);
      }
    }
  } catch (error) {
    console.error('Error viewing artifact:', error);
    alert('Failed to load artifact content.');
  }
};

// ============================================================================
// Chat Interface
// ============================================================================

/**
 * Send a chat message to the API and display the response
 */
async function sendMessage(actionId, message) {
  const chatLoadingEl = document.querySelector('#chat-loading');
  const submitBtn = document.querySelector('#chat-form button[type="submit"]');
  const messageInput = document.querySelector('#chat-form textarea[name="message"]');

  try {
    // Show loading state
    chatLoadingEl.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Append user message immediately
    appendMessage('user', message, true);
    messageInput.value = '';

    const userId = getUserId();
    const response = await fetch(`/.netlify/functions/action-chat/${actionId}?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (data.success) {
      // Append assistant response
      appendMessage('assistant', data.response, true);

      // If North Star was updated, redirect to dashboard after a brief delay
      if (data.north_star_updated) {
        setTimeout(() => {
          window.location.href = '/do/';
        }, 2000);
      }
    } else {
      console.error('Failed to send message:', data.error);
      alert('Failed to send message. Please try again.');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Network error. Please check your connection.');
  } finally {
    // Hide loading state
    chatLoadingEl.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
  }
}

/**
 * Append a message to the chat UI
 */
function appendMessage(role, content, scroll = true) {
  const messagesContainer = document.querySelector('#chat-messages');
  if (!messagesContainer) return;

  // Remove "no messages" placeholder if it exists
  const placeholder = messagesContainer.querySelector('.text-muted');
  if (placeholder) {
    placeholder.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message-${role}`;

  // Render markdown for assistant messages, plain text for user messages
  if (role === 'assistant') {
    messageDiv.innerHTML = marked.parse(content);
  } else {
    messageDiv.textContent = content;
  }

  messagesContainer.appendChild(messageDiv);

  if (scroll) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// ============================================================================
// Form Handlers
// ============================================================================

/**
 * Handle chat form submission
 */
function initChatForm() {
  const chatForm = document.querySelector('#chat-form');
  if (!chatForm) return;

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = e.target.querySelector('textarea[name="message"]');
    const message = input.value.trim();

    if (!message) return;

    const actionId = window.currentActionId;
    if (!actionId) {
      alert('Error: Action ID not found');
      return;
    }

    await sendMessage(actionId, message);
  });
}

/**
 * Handle setup chat - conversational North Star creation
 */
function initSetupChat() {
  const setupChatForm = document.querySelector('#setup-chat-form');
  if (!setupChatForm) return;

  // Store chat history on client side
  const chatHistory = [];

  setupChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = e.target.querySelector('textarea[name="message"]');
    const message = input.value.trim();

    if (!message) return;

    const loadingEl = document.querySelector('#setup-loading');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const messagesContainer = document.querySelector('#setup-messages');

    try {
      // Show loading state
      loadingEl.style.display = 'block';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      // Append user message immediately
      appendSetupMessage('user', message);
      chatHistory.push({ role: 'user', content: message });
      input.value = '';

      // Send to setup-chat API
      const response = await fetch('/api/setup-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatHistory })
      });

      const data = await response.json();

      if (!data.success) {
        alert('Failed to send message. Please try again.');
        return;
      }

      // Append assistant response
      appendSetupMessage('assistant', data.response);
      chatHistory.push({ role: 'assistant', content: data.response });

      // Check if ready to create North Star
      if (data.ready && data.northstarData) {
        // Show final loading state
        submitBtn.textContent = 'Creating...';
        input.disabled = true;

        // Create the Agent
        const userId = getUserId();
        const agentData = { ...data.northstarData, userId };
        const createResponse = await fetch('/.netlify/functions/agent-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData)
        });

        const createResult = await createResponse.json();

        if (createResult.success) {
          // Redirect to dashboard
          window.location.href = '/do/';
        } else {
          alert(createResult.error || 'Failed to create North Star. Please try again.');
          input.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error in setup chat:', error);
      alert('Network error. Please try again.');
    } finally {
      // Hide loading state
      loadingEl.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });
}

/**
 * Append a message to the setup chat UI
 */
function appendSetupMessage(role, content) {
  const messagesContainer = document.querySelector('#setup-messages');
  if (!messagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message-${role}`;

  // Render markdown for assistant messages, plain text for user messages
  if (role === 'assistant') {
    messageDiv.innerHTML = marked.parse(content);
  } else {
    messageDiv.textContent = content;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Handle action controls (complete/dismiss)
 */
function initActionControls() {
  // Mark Complete button
  const completeBtn = document.querySelector('#mark-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      if (!confirm('Mark this action as complete?')) return;

      const actionId = window.currentActionId;

      completeBtn.disabled = true;
      completeBtn.textContent = 'Completing...';

      try {
        const userId = getUserId();
        const response = await fetch(`/.netlify/functions/action-complete/${actionId}?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/do/';
        } else {
          alert('Failed to mark action as complete.');
          completeBtn.disabled = false;
          completeBtn.textContent = 'Mark Complete';
        }
      } catch (error) {
        console.error('Error completing action:', error);
        alert('Network error. Please try again.');
        completeBtn.disabled = false;
        completeBtn.textContent = 'Mark Complete';
      }
    });
  }

  // Dismiss button
  const dismissBtn = document.querySelector('#dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', async () => {
      const reason = prompt('Why are you dismissing this action?');
      if (!reason || !reason.trim()) return;

      const actionId = window.currentActionId;

      dismissBtn.disabled = true;
      dismissBtn.textContent = 'Dismissing...';

      try {
        const userId = getUserId();
        const response = await fetch(`/.netlify/functions/action-dismiss/${actionId}?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/do/';
        } else {
          alert('Failed to dismiss action.');
          dismissBtn.disabled = false;
          dismissBtn.textContent = 'Dismiss';
        }
      } catch (error) {
        console.error('Error dismissing action:', error);
        alert('Network error. Please try again.');
        dismissBtn.disabled = false;
        dismissBtn.textContent = 'Dismiss';
      }
    });
  }

  // Generate Artifact button
  const generateBtn = document.querySelector('#generate-artifact-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const title = prompt('Artifact title:');
      if (!title || !title.trim()) return;

      const type = prompt('Artifact type (markdown, code, image, data):') || 'markdown';
      if (!['markdown', 'code', 'image', 'data'].includes(type)) {
        alert('Invalid artifact type. Please use: markdown, code, image, or data');
        return;
      }

      const actionId = window.currentActionId;

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';

      try {
        const userId = getUserId();
        const response = await fetch(`/.netlify/functions/action-generate/${actionId}?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, title: title.trim() })
        });

        const data = await response.json();

        if (data.success) {
          alert('Artifact generated successfully!');
          location.reload();
        } else {
          alert(data.error || 'Failed to generate artifact.');
          generateBtn.disabled = false;
          generateBtn.textContent = '+ Generate New Artifact';
        }
      } catch (error) {
        console.error('Error generating artifact:', error);
        alert('Network error. Please try again.');
        generateBtn.disabled = false;
        generateBtn.textContent = '+ Generate New Artifact';
      }
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get action ID from current URL
 */
function getActionIdFromUrl() {
  const pathParts = window.location.pathname.split('/').filter(p => p);
  // URL format: /do/action/UUID
  if (pathParts[0] === 'do' && pathParts[1] === 'action' && pathParts[2]) {
    return pathParts[2];
  }
  return null;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format state for display
 */
function formatState(state) {
  if (!state) return 'Unknown';
  return state.split('_').map(capitalize).join(' ');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get icon for artifact type
 */
function getArtifactIcon(type) {
  const icons = {
    markdown: '📄',
    code: '💻',
    image: '🖼️',
    data: '📊'
  };
  return icons[type] || '📄';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);

  // Return precise timestamp with date and time
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// ============================================================================
// Agent Detail Page
// ============================================================================

/**
 * Load and display agent detail page
 */
async function loadAgentDetail() {
  const loadingEl = document.querySelector('#loading-agent');
  const errorEl = document.querySelector('#agent-error');
  const detailEl = document.querySelector('#agent-detail');

  // Get agent ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get('id');

  if (!agentId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const userId = getUserId();

    // Fetch agent details
    const agentResponse = await fetch(`/.netlify/functions/agent-get?userId=${userId}&agentId=${agentId}`);
    const agentData = await agentResponse.json();

    if (!agentData.success || !agentData.agent) {
      throw new Error('Agent not found');
    }

    // Fetch all actions for this agent
    const actionsResponse = await fetch(`/.netlify/functions/actions-list?userId=${userId}&agentId=${agentId}`);
    const actionsData = await actionsResponse.json();

    if (!actionsData.success) {
      throw new Error('Failed to load actions');
    }

    // Display agent details
    displayAgentDetail(agentData.agent, actionsData.actions || []);

    // Initialize filter buttons
    initAgentActionFilters(actionsData.actions || []);

    // Show detail content
    loadingEl.style.display = 'none';
    detailEl.style.display = 'block';

  } catch (error) {
    console.error('Error loading agent detail:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

/**
 * Display agent detail information
 */
function displayAgentDetail(agent, actions) {
  // Agent name and status
  document.querySelector('#agent-name').textContent = agent.name || 'Untitled Agent';

  const statusBadge = document.querySelector('#agent-status-badge');
  statusBadge.textContent = agent.status;
  statusBadge.className = `badge badge-${agent.status === 'active' ? 'open' : agent.status === 'paused' ? 'completed' : 'dismissed'}`;

  // Toggle status button
  const toggleBtn = document.querySelector('#toggle-agent-status-btn');
  toggleBtn.textContent = agent.status === 'paused' ? 'Resume' : 'Pause';
  toggleBtn.onclick = async () => {
    await toggleAgentStatusDetail(agent.id);
  };

  // Metrics
  document.querySelector('#agent-model').textContent = agent.model || 'Sonnet 4.5';
  document.querySelector('#agent-runtime').textContent = formatRuntime(agent._createdAt);
  document.querySelector('#agent-cost').textContent = `$${(agent.metrics?.totalCost || 0).toFixed(2)}`;
  document.querySelector('#agent-projected').textContent = `~$${calculateProjectedCost(agent)}/mo`;
  document.querySelector('#agent-total-actions').textContent = agent.metrics?.totalActions || 0;
  document.querySelector('#agent-completed-actions').textContent = agent.metrics?.completedActions || 0;

  // Instructions
  if (agent.instructions) {
    document.querySelector('#agent-goal').textContent = agent.instructions.goal || 'Not yet defined';

    // Success criteria
    if (agent.instructions.success_criteria && agent.instructions.success_criteria.length > 0) {
      const criteriaList = document.querySelector('#agent-success-criteria');
      criteriaList.innerHTML = agent.instructions.success_criteria
        .map(c => `<li>${escapeHtml(c)}</li>`)
        .join('');
      document.querySelector('#success-criteria-section').style.display = 'block';
    }

    // Timeline
    if (agent.instructions.timeline) {
      document.querySelector('#agent-timeline').textContent = agent.instructions.timeline;
      document.querySelector('#timeline-section').style.display = 'block';
    }
  }

  // Display all actions
  displayAgentActions(actions);
}

/**
 * Display actions for agent detail page
 */
function displayAgentActions(actions, filter = null) {
  const gridEl = document.querySelector('#agent-actions-grid');

  let filteredActions = actions;

  // Apply filter if specified
  if (filter === 'scheduled') {
    filteredActions = actions.filter(a => a.taskType === 'scheduled');
  } else if (filter === 'active') {
    filteredActions = actions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
  } else if (filter === 'completed') {
    filteredActions = actions.filter(a => a.state === 'completed' || a.state === 'dismissed');
  }

  // Clear grid
  gridEl.innerHTML = '';

  if (filteredActions.length === 0) {
    gridEl.innerHTML = '<p class="text-muted">No actions found.</p>';
    return;
  }

  // Add action cards
  filteredActions.forEach(action => {
    const card = createActionCard(action);
    gridEl.appendChild(card);
  });
}

/**
 * Initialize action filter dropdown
 */
function initAgentActionFilters(actions) {
  const filterSelect = document.querySelector('#actions-filter');

  if (filterSelect) {
    filterSelect.onchange = (e) => {
      const filterValue = e.target.value;
      const filter = filterValue === 'all' ? null : filterValue;
      displayAgentActions(actions, filter);
    };
  }
}

/**
 * Toggle agent status on detail page
 */
async function toggleAgentStatusDetail(agentId) {
  try {
    const userId = getUserId();

    // Get current agent to determine new status
    const agentResponse = await fetch(`/.netlify/functions/agent-get?userId=${userId}&agentId=${agentId}`);
    const agentData = await agentResponse.json();

    if (!agentData.success) {
      throw new Error('Failed to fetch agent');
    }

    const newStatus = agentData.agent.status === 'paused' ? 'active' : 'paused';

    // Update agent status
    const updateResponse = await fetch(`/.netlify/functions/agent-update?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, status: newStatus })
    });

    const updateData = await updateResponse.json();

    if (!updateData.success) {
      throw new Error('Failed to update agent status');
    }

    // Reload page
    location.reload();

  } catch (error) {
    console.error('Error toggling agent status:', error);
    alert('Failed to update agent status. Please try again.');
  }
}

// ============================================================================
// Page-specific initialization
// ============================================================================

/**
 * Initialize based on current page
 */
function initPage() {
  const path = window.location.pathname;

  // Initialize breadcrumb state preservation on all pages
  initBreadcrumb();

  if (path === '/do/' || path === '/do/index.html') {
    // Agent dashboard page
    loadDashboard();
  } else if (path.startsWith('/do/agent')) {
    // Agent detail page
    loadAgentDetail();
  } else if (path.startsWith('/do/action')) {
    // Action detail page
    loadActionDetail();
    initChatForm();
    initActionControls();
  } else if (path.startsWith('/do/file')) {
    // File viewer page
    loadFileView();
  } else if (path.startsWith('/do/setup')) {
    // Setup page
    initSetupChat();
  }
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', initPage);
