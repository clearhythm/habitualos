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
let currentNotes = [];
let currentTimeEntries = [];
let currentTotalMinutes = 0;
let allProjects = [];
let allAgents = [];
let allGoals = [];

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

    // Load goals for the action's project (if it has one)
    if (currentAction.projectId) {
      try {
        const goalsResponse = await fetch(`/.netlify/functions/goals-list?userId=${userId}&projectId=${currentAction.projectId}`);
        const goalsData = await goalsResponse.json();
        allGoals = goalsData.success ? (goalsData.goals || []) : [];
      } catch (e) {
        allGoals = [];
      }
    }

    // Store notes for later use
    currentNotes = data.notes || [];

    // Store time entries
    currentTimeEntries = data.timeEntries || [];
    currentTotalMinutes = data.totalMinutes || 0;

    // Display action details
    displayActionDetail(data.action, data.chat || [], data.artifacts || [], currentNotes, currentTimeEntries, currentTotalMinutes);

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

function getGoalName(goalId) {
  if (!goalId) return null;
  const goal = allGoals.find(g => g.id === goalId);
  return goal ? goal.title : null;
}

function formatDescription(text) {
  if (!text) return 'No description available.';
  // Escape HTML first
  let formatted = escapeHtml(text);
  // Make URLs clickable
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563eb;">$1</a>'
  );
  return formatted;
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

  // Goal link
  const goalName = getGoalName(action.goalId);
  const goalEl = document.querySelector('#parent-goal');
  const goalLink = document.querySelector('#parent-goal-link');
  if (goalEl && goalLink && goalName) {
    goalLink.textContent = goalName;
    goalLink.href = `/do/goal/?id=${action.goalId}`;
    goalEl.style.display = 'block';
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
function displayActionDetail(action, chatHistory, artifacts, notes, timeEntries, totalMinutes) {
  // Display action header
  document.querySelector('#action-title').textContent = action.title;

  const badgesEl = document.querySelector('#action-badges');
  badgesEl.innerHTML = `
    <span class="badge badge-${action.priority}">${capitalize(action.priority)} Priority</span>
    <span class="badge badge-${action.state}">${formatState(action.state)}</span>
  `;

  // Display description (with line breaks preserved and links clickable)
  document.querySelector('#action-description').innerHTML = formatDescription(action.description);

  // Display due date
  const dueDateEl = document.querySelector('#action-due-date');
  if (dueDateEl && action.dueDate) {
    dueDateEl.textContent = `Due: ${formatDate(action.dueDate)}`;
    dueDateEl.style.display = 'block';
  }

  // Display parent section (project/agent links)
  displayParentSection(action);

  // Display notes
  displayNotes(notes);

  // Display time entries
  displayTimeEntries(timeEntries, totalMinutes);

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
// Notes Display
// -----------------------------
function displayNotes(notes) {
  const notesListEl = document.querySelector('#notes-list');
  const noNotesEl = document.querySelector('#no-notes');

  if (!notesListEl) return;

  notesListEl.innerHTML = '';

  if (!notes || notes.length === 0) {
    if (noNotesEl) noNotesEl.style.display = 'block';
    return;
  }

  if (noNotesEl) noNotesEl.style.display = 'none';

  // Sort notes by creation date (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a._createdAt || 0);
    const dateB = new Date(b._createdAt || 0);
    return dateB - dateA;
  });

  sortedNotes.forEach(note => {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-item';
    noteEl.dataset.noteId = note.id;
    noteEl.style.cssText = 'padding: 0.75rem; background: #f9fafb; border-radius: 4px; margin-bottom: 0.5rem;';

    const created = note._createdAt ? formatDate(note._createdAt) : '';

    noteEl.innerHTML = `
      <div class="note-content" style="white-space: pre-wrap; margin-bottom: 0.5rem;">${escapeHtml(note.content)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
        <span style="color: #9ca3af;">${created}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button class="note-edit-btn" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 0.8rem;">Edit</button>
          <button class="note-delete-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem;">Delete</button>
        </div>
      </div>
    `;

    // Bind edit handler
    const editBtn = noteEl.querySelector('.note-edit-btn');
    editBtn.addEventListener('click', () => editNote(note.id, note.content));

    // Bind delete handler
    const deleteBtn = noteEl.querySelector('.note-delete-btn');
    deleteBtn.addEventListener('click', () => deleteNote(note.id));

    notesListEl.appendChild(noteEl);
  });
}

async function addNote(content) {
  const userId = getUserId();

  try {
    const response = await fetch('/.netlify/functions/action-note-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, actionId: currentActionId, content })
    });

    const data = await response.json();

    if (data.success) {
      // Add note to local state and re-render
      const newNote = {
        id: data.note.id,
        actionId: currentActionId,
        content,
        _createdAt: new Date().toISOString()
      };
      currentNotes.unshift(newNote);
      displayNotes(currentNotes);
      return true;
    } else {
      log('error', 'Failed to add note:', data.error);
      alert('Failed to add note.');
      return false;
    }
  } catch (error) {
    log('error', 'Error adding note:', error);
    alert('Network error. Please try again.');
    return false;
  }
}

async function editNote(noteId, currentContent) {
  const newContent = prompt('Edit note:', currentContent);
  if (newContent === null || newContent.trim() === currentContent) return;

  if (!newContent.trim()) {
    alert('Note content cannot be empty.');
    return;
  }

  const userId = getUserId();

  try {
    const response = await fetch('/.netlify/functions/action-note-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, noteId, content: newContent.trim() })
    });

    const data = await response.json();

    if (data.success) {
      // Update local state and re-render
      const note = currentNotes.find(n => n.id === noteId);
      if (note) {
        note.content = newContent.trim();
        displayNotes(currentNotes);
      }
    } else {
      log('error', 'Failed to update note:', data.error);
      alert('Failed to update note.');
    }
  } catch (error) {
    log('error', 'Error updating note:', error);
    alert('Network error. Please try again.');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Delete this note?')) return;

  const userId = getUserId();

  try {
    const response = await fetch('/.netlify/functions/action-note-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, noteId })
    });

    const data = await response.json();

    if (data.success) {
      // Remove from local state and re-render
      currentNotes = currentNotes.filter(n => n.id !== noteId);
      displayNotes(currentNotes);
    } else {
      log('error', 'Failed to delete note:', data.error);
      alert('Failed to delete note.');
    }
  } catch (error) {
    log('error', 'Error deleting note:', error);
    alert('Network error. Please try again.');
  }
}

// -----------------------------
// Time Tracking
// -----------------------------
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function displayTimeEntries(entries, totalMinutes) {
  const entriesListEl = document.querySelector('#time-entries-list');
  const noEntriesEl = document.querySelector('#no-time-entries');
  const totalEl = document.querySelector('#time-total');

  if (!entriesListEl) return;

  // Display total
  if (totalEl) {
    totalEl.textContent = totalMinutes > 0 ? `${formatDuration(totalMinutes)} total` : '';
  }

  entriesListEl.innerHTML = '';

  if (!entries || entries.length === 0) {
    if (noEntriesEl) noEntriesEl.style.display = 'block';
    return;
  }

  if (noEntriesEl) noEntriesEl.style.display = 'none';

  // Sort entries by loggedAt (newest first)
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = new Date(a.loggedAt || 0);
    const dateB = new Date(b.loggedAt || 0);
    return dateB - dateA;
  });

  sortedEntries.forEach(entry => {
    const entryEl = document.createElement('div');
    entryEl.className = 'time-entry-item';
    entryEl.dataset.entryId = entry.id;
    entryEl.style.cssText = 'padding: 0.75rem; background: #f9fafb; border-radius: 4px; margin-bottom: 0.5rem;';

    const loggedDate = entry.loggedAt ? formatDate(entry.loggedAt) : '';

    entryEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-weight: 600;">${formatDuration(entry.duration)}</span>
          ${entry.note ? `<span style="color: #6b7280; margin-left: 0.5rem;">- ${escapeHtml(entry.note)}</span>` : ''}
        </div>
        <button class="time-entry-delete-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem;">Delete</button>
      </div>
      <div style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.25rem;">${loggedDate}</div>
    `;

    // Bind delete handler
    const deleteBtn = entryEl.querySelector('.time-entry-delete-btn');
    deleteBtn.addEventListener('click', () => deleteTimeEntry(entry.id));

    entriesListEl.appendChild(entryEl);
  });
}

async function addTimeEntry(duration, note) {
  const userId = getUserId();

  try {
    const response = await fetch('/.netlify/functions/action-time-entry-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        actionId: currentActionId,
        duration,
        note: note || null
      })
    });

    const data = await response.json();

    if (data.success) {
      // Add entry to local state and re-render
      const newEntry = {
        id: data.entry.id,
        actionId: currentActionId,
        duration,
        note: note || null,
        loggedAt: data.entry.loggedAt
      };
      currentTimeEntries.unshift(newEntry);
      currentTotalMinutes = data.totalMinutes;
      displayTimeEntries(currentTimeEntries, currentTotalMinutes);
      return true;
    } else {
      log('error', 'Failed to log time:', data.error);
      alert('Failed to log time.');
      return false;
    }
  } catch (error) {
    log('error', 'Error logging time:', error);
    alert('Network error. Please try again.');
    return false;
  }
}

async function deleteTimeEntry(entryId) {
  if (!confirm('Delete this time entry?')) return;

  const userId = getUserId();

  try {
    const response = await fetch('/.netlify/functions/action-time-entry-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, entryId })
    });

    const data = await response.json();

    if (data.success) {
      // Remove from local state and re-render
      currentTimeEntries = currentTimeEntries.filter(e => e.id !== entryId);
      currentTotalMinutes = data.totalMinutes;
      displayTimeEntries(currentTimeEntries, currentTotalMinutes);
    } else {
      log('error', 'Failed to delete time entry:', data.error);
      alert('Failed to delete time entry.');
    }
  } catch (error) {
    log('error', 'Error deleting time entry:', error);
    alert('Network error. Please try again.');
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

  function populateGoalDropdown() {
    const goalSelect = document.querySelector('#edit-goal');
    if (!goalSelect) return;

    goalSelect.innerHTML = '<option value="">No goal (ungrouped)</option>';
    allGoals.forEach(goal => {
      if (goal.state === 'active' || goal.id === currentAction.goalId) {
        const option = document.createElement('option');
        option.value = goal.id;
        option.textContent = goal.title || 'Untitled Goal';
        if (goal.id === currentAction.goalId) {
          option.selected = true;
        }
        goalSelect.appendChild(option);
      }
    });
  }

  function openModal() {
    if (!currentAction) return;
    document.querySelector('#edit-title').value = currentAction.title || '';
    document.querySelector('#edit-description').value = currentAction.description || '';
    document.querySelector('#edit-priority').value = currentAction.priority || 'medium';
    document.querySelector('#edit-due-date').value = currentAction.dueDate || '';
    populateGoalDropdown();
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
    const goalSelect = document.querySelector('#edit-goal');
    const goalId = goalSelect ? (goalSelect.value || null) : currentAction.goalId;

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
          dueDate,
          goalId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        currentAction.title = title;
        currentAction.description = description;
        currentAction.priority = priority;
        currentAction.dueDate = dueDate;
        currentAction.goalId = goalId;

        // Update UI
        document.querySelector('#action-title').textContent = title;
        document.querySelector('#action-description').innerHTML = formatDescription(description);

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

        // Update goal link
        displayParentSection(currentAction);

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
// Notes Form
// -----------------------------
function initNotesForm() {
  const notesForm = document.querySelector('#add-note-form');
  if (!notesForm) return;

  notesForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.querySelector('#note-content');
    const content = input.value.trim();

    if (!content) return;

    const addBtn = document.querySelector('#add-note-btn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    const success = await addNote(content);

    if (success) {
      input.value = '';
    }

    addBtn.disabled = false;
    addBtn.textContent = 'Add Note';
  });
}

// -----------------------------
// Time Tracking Form
// -----------------------------
function initTimeForm() {
  const timeForm = document.querySelector('#log-time-form');
  if (!timeForm) return;

  timeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const durationInput = document.querySelector('#time-duration');
    const noteInput = document.querySelector('#time-note');

    const duration = parseInt(durationInput.value, 10);
    const note = noteInput.value.trim();

    if (!duration || duration <= 0) return;

    const logBtn = document.querySelector('#log-time-btn');
    logBtn.disabled = true;
    logBtn.textContent = 'Logging...';

    const success = await addTimeEntry(duration, note);

    if (success) {
      durationInput.value = '';
      noteInput.value = '';
    }

    logBtn.disabled = false;
    logBtn.textContent = 'Log Time';
  });
}

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
  initNotesForm();
  initTimeForm();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
