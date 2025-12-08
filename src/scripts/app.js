// HabitualOS Client-Side JavaScript
// Handles dynamic data loading, chat interface, form submissions, and UI interactions

// ============================================================================
// Dashboard Data Loading
// ============================================================================

/**
 * Load and display dashboard data (North Star + Actions)
 */
async function loadDashboard() {
  const loadingEl = document.querySelector('#loading-dashboard');
  const noNorthstarEl = document.querySelector('#no-northstar');
  const dashboardContentEl = document.querySelector('#dashboard-content');

  try {
    // Fetch North Star - for PoC we assume there's only one
    const northstarResponse = await fetch('/api/northstar-get');
    const northstarData = await northstarResponse.json();

    if (!northstarData.success || !northstarData.northstar) {
      // No North Star exists yet, show setup prompt
      loadingEl.style.display = 'none';
      noNorthstarEl.style.display = 'block';
      return;
    }

    // If setup action was just created, redirect to it
    if (northstarData.setupActionId) {
      window.location.href = `/action/${northstarData.setupActionId}`;
      return;
    }

    // Fetch all actions
    const actionsResponse = await fetch('/api/actions-list');
    const actionsData = await actionsResponse.json();

    if (!actionsData.success) {
      throw new Error('Failed to load actions');
    }

    // Display North Star
    displayNorthStar(northstarData.northstar, actionsData.actions || []);

    // Display Actions
    displayActions(actionsData.actions || []);

    // Show dashboard content
    loadingEl.style.display = 'none';
    dashboardContentEl.style.display = 'block';

  } catch (error) {
    console.error('Error loading dashboard:', error);
    loadingEl.innerHTML = '<p class="text-muted" style="color: red;">Error loading dashboard. Please refresh the page.</p>';
  }
}

/**
 * Display North Star data and agent cards
 */
function displayNorthStar(northstar, actions) {
  const runUndefined = document.querySelector('#northstar-undefined');
  const runDefined = document.querySelector('#northstar-defined');
  const configUndefined = document.querySelector('#config-undefined');
  const configDefined = document.querySelector('#config-defined');
  const statusBadge = document.querySelector('#agent-status');

  // Find the "Define Your North Star Goal" action
  const setupAction = actions.find(a => a.title === 'Define Your North Star Goal');

  // North Star is only "defined" if the setup action is completed
  const isUndefined = !setupAction || setupAction.state !== 'completed';

  if (isUndefined) {
    // Show undefined state - Run card
    runUndefined.style.display = 'block';
    runDefined.style.display = 'none';

    // Show undefined state - Config card
    configUndefined.style.display = 'block';
    configDefined.style.display = 'none';

    // Link to the setup action
    if (setupAction) {
      const createLink = document.querySelector('#create-northstar-link');
      const configLink = document.querySelector('#config-northstar-link');
      createLink.href = `/action/${setupAction.id}`;
      configLink.href = `/action/${setupAction.id}`;
    }
  } else {
    // Show defined state - Run card
    runUndefined.style.display = 'none';
    runDefined.style.display = 'block';

    // Show defined state - Config card
    configUndefined.style.display = 'none';
    configDefined.style.display = 'block';

    document.querySelector('#config-northstar-title').textContent = northstar.title;
  }

  // Update Live Stats card
  const completedCount = actions.filter(a => a.state === 'completed').length;
  document.querySelector('#actions-completed-count').textContent = completedCount;

  // Get last completed action timestamp
  const completedActions = actions.filter(a => a.state === 'completed' && a.updated_at);
  if (completedActions.length > 0) {
    const lastCompleted = completedActions.sort((a, b) =>
      new Date(b.updated_at) - new Date(a.updated_at)
    )[0];
    document.querySelector('#last-run-time').textContent = formatDate(lastCompleted.updated_at);
  } else {
    document.querySelector('#last-run-time').textContent = 'Never';
  }

  // Update status badge
  statusBadge.textContent = northstar.status === 'active' ? 'Active' : northstar.status;
  statusBadge.className = `badge badge-${northstar.status === 'active' ? 'open' : 'completed'}`;
}

/**
 * Display action cards and calculate progress
 */
function displayActions(actions) {
  const activeActionsEl = document.querySelector('#active-actions');
  const completedActionsEl = document.querySelector('#completed-actions');
  const toggleBtn = document.querySelector('#toggle-completed');

  // Separate active and completed actions
  const activeActions = actions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
  const completedActions = actions.filter(a => a.state === 'completed' || a.state === 'dismissed');

  // Display active actions
  activeActionsEl.innerHTML = '';
  activeActions.forEach(action => {
    activeActionsEl.appendChild(createActionCard(action));
  });

  // Display completed actions
  completedActionsEl.innerHTML = '';
  completedActions.forEach(action => {
    const card = createActionCard(action);
    card.style.opacity = '0.7';
    completedActionsEl.appendChild(card);
  });

  // Update toggle button
  if (completedActions.length > 0) {
    toggleBtn.textContent = `Show Completed (${completedActions.length})`;
    toggleBtn.style.display = 'inline-block';
  }
}

/**
 * Create an action card element
 */
function createActionCard(action) {
  const card = document.createElement('a');
  card.href = `/action/${action.id}`;
  card.className = 'card card-clickable';
  card.style.textDecoration = 'none';

  const priorityBadge = `<span class="badge badge-${action.priority}">${capitalize(action.priority)}</span>`;
  const stateBadge = `<span class="badge badge-${action.state}">${formatState(action.state)}</span>`;

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
    const response = await fetch(`/api/action-get/${actionId}`);
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
    const response = await fetch(`/api/action-get/${actionId}`);
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

    const response = await fetch(`/api/action-chat/${actionId}`, {
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
          window.location.href = '/';
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

        // Create the North Star
        const createResponse = await fetch('/api/northstar-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.northstarData)
        });

        const createResult = await createResponse.json();

        if (createResult.success) {
          // Redirect to dashboard
          window.location.href = '/';
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
        const response = await fetch(`/api/action-complete/${actionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/';
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
        const response = await fetch(`/api/action-dismiss/${actionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/';
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
        const response = await fetch(`/api/action-generate/${actionId}`, {
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

/**
 * Toggle completed actions visibility
 */
function initToggleCompleted() {
  const toggleBtn = document.querySelector('#toggle-completed');
  const completedSection = document.querySelector('#completed-actions');

  if (toggleBtn && completedSection) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = completedSection.style.display === 'none';

      if (isHidden) {
        completedSection.style.display = 'grid';
        const count = completedSection.children.length;
        toggleBtn.textContent = `Hide Completed (${count})`;
      } else {
        completedSection.style.display = 'none';
        const count = completedSection.children.length;
        toggleBtn.textContent = `Show Completed (${count})`;
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
  // URL format: /action/UUID
  if (pathParts[0] === 'action' && pathParts[1]) {
    return pathParts[1];
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
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

// ============================================================================
// Page-specific initialization
// ============================================================================

/**
 * Initialize based on current page
 */
function initPage() {
  const path = window.location.pathname;

  if (path === '/' || path === '/index.html') {
    // Dashboard page
    loadDashboard();
    initToggleCompleted();
  } else if (path.startsWith('/action')) {
    // Action detail page
    loadActionDetail();
    initChatForm();
    initActionControls();
  }
  // /setup page now just redirects to dashboard
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', initPage);
