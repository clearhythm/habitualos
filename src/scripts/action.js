//
// scripts/action.js
// ------------------------------------------------------
// Action detail page module - handles action viewing, chat, artifacts
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { log } from '/assets/js/utils/log.js';
import { formatDate, escapeHtml, capitalize, formatState, formatFileSize, getArtifactIcon, getActionIdFromUrl } from '/assets/js/utils/utils.js';

// -----------------------------
// State
// -----------------------------
let currentActionId = null;
let currentAction = null;
let allProjects = [];
let allAgents = [];

// -----------------------------
// Action Loading
// -----------------------------
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

    // Load action, projects, and agents in parallel
    const [actionResponse, projectsResponse, agentsResponse] = await Promise.all([
      fetch(`/.netlify/functions/action-get/${actionId}?userId=${userId}`),
      fetch(`/.netlify/functions/projects-list?userId=${userId}`),
      fetch(`/.netlify/functions/agents-list?userId=${userId}`)
    ]);

    const data = await actionResponse.json();
    const projectsData = await projectsResponse.json();
    const agentsData = await agentsResponse.json();

    if (!data.success || !data.action) {
      throw new Error('Action not found');
    }

    // Store projects and agents for lookups
    allProjects = projectsData.success ? (projectsData.projects || []) : [];
    allAgents = agentsData.success ? (agentsData.agents || []) : [];

    // Store action for later use
    currentAction = data.action;

    // Display action details
    displayActionDetail(data.action, data.chat || [], data.artifacts || []);

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Store action ID for form submissions
    currentActionId = actionId;

  } catch (error) {
    log('error', 'Error loading action:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// -----------------------------
// Helper Functions
// -----------------------------
function getProjectName(projectId) {
  if (!projectId) return null;
  const project = allProjects.find(p => p.id === projectId);
  return project ? project.name : null;
}

function getAgentName(agentId) {
  if (!agentId) return null;
  const agent = allAgents.find(a => a.id === agentId);
  return agent ? agent.name : null;
}

function displayParentSection(action) {
  const parentSection = document.querySelector('#parent-section');
  if (!parentSection) return;

  let hasParent = false;

  // Project link
  const projectName = getProjectName(action.projectId);
  const projectEl = document.querySelector('#parent-project');
  const projectLink = document.querySelector('#parent-project-link');
  if (projectEl && projectLink && projectName) {
    projectLink.textContent = projectName;
    projectLink.href = `/do/project/?id=${action.projectId}`;
    projectEl.style.display = 'block';
    hasParent = true;
  }

  // Agent link
  const agentName = getAgentName(action.agentId);
  const agentEl = document.querySelector('#parent-agent');
  const agentLink = document.querySelector('#parent-agent-link');
  if (agentEl && agentLink && agentName) {
    agentLink.textContent = agentName;
    agentLink.href = `/do/agent/?id=${action.agentId}`;
    agentEl.style.display = 'block';
    hasParent = true;
  }

  // Created date
  const createdEl = document.querySelector('#action-created');
  if (createdEl && action._createdAt) {
    createdEl.textContent = `Created: ${formatDate(action._createdAt)}`;
    hasParent = true;
  }

  // Show section if any parent info exists
  if (hasParent) {
    parentSection.style.display = 'block';
  }
}

// -----------------------------
// Action Display
// -----------------------------
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

  // Display due date
  const dueDateEl = document.querySelector('#action-due-date');
  if (dueDateEl && action.dueDate) {
    dueDateEl.textContent = `Due: ${formatDate(action.dueDate)}`;
    dueDateEl.style.display = 'block';
  }

  // Display parent section (project/agent links)
  displayParentSection(action);

  // Hide action controls if completed/dismissed
  const isCompleted = ['completed', 'dismissed'].includes(action.state);
  const completeBtn = document.querySelector('#mark-complete-btn');
  const dismissBtn = document.querySelector('#dismiss-btn');
  const durationInput = document.querySelector('#complete-duration-input');
  if (completeBtn && isCompleted) {
    completeBtn.style.display = 'none';
    if (durationInput) durationInput.style.display = 'none';
  }
  if (dismissBtn && isCompleted) {
    dismissBtn.style.display = 'none';
  }

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

// -----------------------------
// Scheduled Task Display
// -----------------------------
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

  // Setup "Run Now" button
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

// -----------------------------
// Output Files
// -----------------------------
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
    log('error', 'Error fetching output files:', error);
    outputFilesEl.innerHTML = '<p class="text-muted">Error loading output files.</p>';
    outputFilesEl.style.display = 'block';
    noOutputsEl.style.display = 'none';
  }
}

// -----------------------------
// Artifacts Display
// -----------------------------
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

// -----------------------------
// View Artifact
// -----------------------------
async function viewArtifact(artifactId) {
  try {
    const userId = getUserId();
    const response = await fetch(`/.netlify/functions/action-get/${currentActionId}?userId=${userId}`);
    const data = await response.json();

    if (data.success && data.artifacts) {
      const artifact = data.artifacts.find(a => a.id === artifactId);
      if (artifact) {
        alert(`${artifact.title}\n\n${artifact.content}`);
      }
    }
  } catch (error) {
    log('error', 'Error viewing artifact:', error);
    alert('Failed to load artifact content.');
  }
}

// -----------------------------
// Chat Interface
// -----------------------------
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
      log('error', 'Failed to send message:', data.error);
      alert('Failed to send message. Please try again.');
    }
  } catch (error) {
    log('error', 'Error sending message:', error);
    alert('Network error. Please check your connection.');
  } finally {
    // Hide loading state
    chatLoadingEl.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
  }
}

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

// -----------------------------
// Form Handlers
// -----------------------------
function initChatForm() {
  const chatForm = document.querySelector('#chat-form');
  if (!chatForm) return;

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = e.target.querySelector('textarea[name="message"]');
    const message = input.value.trim();

    if (!message) return;

    if (!currentActionId) {
      alert('Error: Action ID not found');
      return;
    }

    await sendMessage(currentActionId, message);
  });
}

function initActionControls() {
  // Mark Complete button
  const completeBtn = document.querySelector('#mark-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      completeBtn.disabled = true;
      completeBtn.textContent = 'Completing...';

      try {
        const userId = getUserId();
        const durationInput = document.querySelector('#complete-duration-input');
        const duration = durationInput?.value ? parseInt(durationInput.value, 10) : null;

        const response = await fetch(`/.netlify/functions/action-complete/${currentActionId}?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration })
        });

        const data = await response.json();

        if (data.success) {
          // Store EA message if present
          if (data.ea?.message) {
            sessionStorage.setItem('pending_ea_message', data.ea.message);
          }
          window.location.href = '/do/actions/';
        } else {
          alert('Failed to mark action as complete.');
          completeBtn.disabled = false;
          completeBtn.textContent = 'Complete';
        }
      } catch (error) {
        log('error', 'Error completing action:', error);
        alert('Network error. Please try again.');
        completeBtn.disabled = false;
        completeBtn.textContent = 'Complete';
      }
    });
  }

  // Dismiss button
  const dismissBtn = document.querySelector('#dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', async () => {
      const reason = prompt('Why are you dismissing this action?');
      if (!reason || !reason.trim()) return;

      dismissBtn.disabled = true;
      dismissBtn.textContent = 'Dismissing...';

      try {
        const userId = getUserId();
        const response = await fetch(`/.netlify/functions/action-dismiss/${currentActionId}?userId=${userId}`, {
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
        log('error', 'Error dismissing action:', error);
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

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';

      try {
        const userId = getUserId();
        const response = await fetch(`/.netlify/functions/action-generate/${currentActionId}?userId=${userId}`, {
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
        log('error', 'Error generating artifact:', error);
        alert('Network error. Please try again.');
        generateBtn.disabled = false;
        generateBtn.textContent = '+ Generate New Artifact';
      }
    });
  }
}

// -----------------------------
// Edit Modal
// -----------------------------
function initEditModal() {
  const editBtn = document.querySelector('#edit-action-btn');
  const editModal = document.querySelector('#edit-action-modal');
  const closeBtn = document.querySelector('#close-edit-modal');
  const cancelBtn = document.querySelector('#cancel-edit');
  const editForm = document.querySelector('#edit-action-form');

  if (!editBtn || !editModal || !editForm) return;

  function openModal() {
    if (!currentAction) return;
    document.querySelector('#edit-title').value = currentAction.title || '';
    document.querySelector('#edit-description').value = currentAction.description || '';
    document.querySelector('#edit-priority').value = currentAction.priority || 'medium';
    document.querySelector('#edit-due-date').value = currentAction.dueDate || '';
    editModal.style.display = 'block';
  }

  function closeModal() {
    editModal.style.display = 'none';
  }

  editBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.querySelector('#edit-title').value.trim();
    const description = document.querySelector('#edit-description').value.trim();
    const priority = document.querySelector('#edit-priority').value;
    const dueDate = document.querySelector('#edit-due-date').value || null;

    const submitBtn = document.querySelector('#submit-edit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/action-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          actionId: currentActionId,
          title,
          description,
          priority,
          dueDate
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        currentAction.title = title;
        currentAction.description = description;
        currentAction.priority = priority;
        currentAction.dueDate = dueDate;

        // Update UI
        document.querySelector('#action-title').textContent = title;
        document.querySelector('#action-description').textContent = description || 'No description available.';

        const badgesEl = document.querySelector('#action-badges');
        badgesEl.innerHTML = `
          <span class="badge badge-${priority}">${capitalize(priority)} Priority</span>
          <span class="badge badge-${currentAction.state}">${formatState(currentAction.state)}</span>
        `;

        const dueDateEl = document.querySelector('#action-due-date');
        if (dueDateEl) {
          if (dueDate) {
            dueDateEl.textContent = `Due: ${formatDate(dueDate)}`;
            dueDateEl.style.display = 'block';
          } else {
            dueDateEl.style.display = 'none';
          }
        }

        closeModal();
      } else {
        alert(data.error || 'Failed to update action.');
      }
    } catch (error) {
      log('error', 'Error updating action:', error);
      alert('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });
}

// -----------------------------
// Global Window Functions
// -----------------------------
window.viewArtifact = viewArtifact;

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  log('debug', 'Initializing action module');

  // Initialize user
  initializeUser();

  // Load action detail
  loadActionDetail();

  // Initialize form handlers
  initChatForm();
  initActionControls();
  initEditModal();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
