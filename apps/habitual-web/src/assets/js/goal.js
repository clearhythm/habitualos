//
// scripts/goal.js
// ------------------------------------------------------
// Goal detail page module - handles goal viewing, actions, progress
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { formatDate, escapeHtml, capitalize } from '/assets/js/utils/utils.js';
import { showActionModal } from '/assets/js/components/action-modal.js';

// -----------------------------
// State
// -----------------------------
let currentGoalId = null;
let currentGoal = null;
let currentProject = null;
let currentActions = [];
let currentProgress = { total: 0, completed: 0, percentage: 0 };

// -----------------------------
// URL Helpers
// -----------------------------
function getGoalIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// -----------------------------
// Goal Loading
// -----------------------------
async function loadGoalDetail() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error-state');
  const detailEl = document.getElementById('goal-detail');

  const goalId = getGoalIdFromUrl();

  if (!goalId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const userId = getUserId();
    const response = await fetch(`/.netlify/functions/goal-get/${goalId}?userId=${userId}`);
    const data = await response.json();

    if (!data.success || !data.goal) {
      throw new Error('Goal not found');
    }

    // Store data
    currentGoalId = goalId;
    currentGoal = data.goal;
    currentProject = data.project;
    currentActions = data.actions || [];
    currentProgress = data.progress || { total: 0, completed: 0, percentage: 0 };

    // Update back link
    if (currentProject) {
      const backLink = document.getElementById('back-link');
      backLink.href = `/do/project/?id=${currentProject.id}`;
      backLink.textContent = `← Back to ${currentProject.name}`;
    }

    // Display goal
    displayGoal();
    displayProgress();
    displayActions();
    updateCounts();

    // Show content
    loadingEl.style.display = 'none';
    detailEl.style.display = 'block';

    // Setup interactions
    setupViewNavigation();
    setupEditModal();
    setupAddActionModal();
    setupGoalActions();

  } catch (error) {
    console.error('Error loading goal:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// -----------------------------
// Display Functions
// -----------------------------
function displayGoal() {
  document.getElementById('goal-title').textContent = currentGoal.title || 'Untitled Goal';
  document.getElementById('goal-description').textContent = currentGoal.description || '';

  const stateEl = document.getElementById('goal-state');
  const stateClass = `state-${currentGoal.state}`;
  stateEl.className = `goal-state ${stateClass}`;
  stateEl.textContent = currentGoal.state;

  // Project link
  if (currentProject) {
    document.getElementById('project-link').textContent = currentProject.name;
    document.getElementById('project-link').href = `/do/project/?id=${currentProject.id}`;
    document.getElementById('parent-project').style.display = 'block';
  }

  // Update action buttons visibility based on state
  const completeBtn = document.getElementById('complete-goal-btn');
  const archiveBtn = document.getElementById('archive-goal-btn');

  if (currentGoal.state === 'completed') {
    completeBtn.style.display = 'none';
    archiveBtn.textContent = 'Archive';
  } else if (currentGoal.state === 'archived') {
    completeBtn.style.display = 'none';
    archiveBtn.textContent = 'Unarchive';
  }
}

function displayProgress() {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  progressBar.style.width = `${currentProgress.percentage}%`;
  progressText.textContent = `${currentProgress.completed} of ${currentProgress.total} (${currentProgress.percentage}%)`;
}

function displayActions() {
  renderActionsList('open');
  renderActionsList('completed');
}

function renderActionsList(filter) {
  const listId = `${filter}-list`;
  const emptyId = `${filter}-empty`;
  const listEl = document.getElementById(listId);
  const emptyEl = document.getElementById(emptyId);

  listEl.innerHTML = '';

  // Filter actions
  let filteredActions;
  if (filter === 'open') {
    filteredActions = currentActions.filter(a => !['completed', 'dismissed'].includes(a.state));
  } else {
    filteredActions = currentActions.filter(a => a.state === 'completed');
  }

  // Sort by creation date, newest first
  filteredActions.sort((a, b) => {
    const dateA = new Date(a._createdAt || 0);
    const dateB = new Date(b._createdAt || 0);
    return dateB - dateA;
  });

  if (filteredActions.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';

  filteredActions.forEach(action => {
    const item = document.createElement('div');
    item.className = 'action-item';

    const badgeClass = `badge-${action.state}`;
    const priorityText = action.priority === 'high' ? 'High' :
                         action.priority === 'low' ? 'Low' : 'Medium';

    item.innerHTML = `
      <div class="item-info">
        <h3 class="item-name">${escapeHtml(action.title || 'Untitled Action')}</h3>
        <div class="item-meta">${priorityText} priority • ${action.taskType || 'manual'}</div>
      </div>
      <span class="item-badge ${badgeClass}">${action.state}</span>
    `;

    item.addEventListener('click', () => {
      showActionModal(action, {
        onComplete: () => loadGoalDetail()
      });
    });

    listEl.appendChild(item);
  });
}

function updateCounts() {
  const openCount = currentActions.filter(a => !['completed', 'dismissed'].includes(a.state)).length;
  const completedCount = currentActions.filter(a => a.state === 'completed').length;

  document.getElementById('open-count').textContent = openCount;
  document.getElementById('completed-count').textContent = completedCount;
}

// -----------------------------
// View Navigation
// -----------------------------
function setupViewNavigation() {
  const viewLinks = document.querySelectorAll('.view-link');
  const views = document.querySelectorAll('.goal-view');

  function switchView(viewName) {
    viewLinks.forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
        link.style.color = '#2563eb';
      } else {
        link.classList.remove('active');
        link.style.color = '#6b7280';
      }
    });

    views.forEach(view => {
      view.style.display = view.id === `view-${viewName}` ? 'block' : 'none';
    });
  }

  viewLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = link.dataset.view;
      switchView(viewName);
      history.replaceState(null, '', `#${viewName}`);
    });
  });

  // Handle initial hash
  const hash = window.location.hash.slice(1);
  if (['open', 'completed'].includes(hash)) {
    switchView(hash);
  }
}

// -----------------------------
// Edit Modal
// -----------------------------
function setupEditModal() {
  const editBtn = document.getElementById('edit-goal-btn');
  const modal = document.getElementById('edit-goal-modal');
  const closeBtn = document.getElementById('close-edit-modal');
  const cancelBtn = document.getElementById('cancel-edit');
  const form = document.getElementById('edit-goal-form');

  function openModal() {
    document.getElementById('edit-title').value = currentGoal.title || '';
    document.getElementById('edit-description').value = currentGoal.description || '';
    modal.style.display = 'block';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  editBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('edit-title').value.trim();
    const description = document.getElementById('edit-description').value.trim();

    if (!title) return;

    const submitBtn = document.getElementById('submit-edit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/goal-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goalId: currentGoalId,
          title,
          description: description || null
        })
      });

      const data = await response.json();

      if (data.success) {
        currentGoal.title = title;
        currentGoal.description = description || null;
        displayGoal();
        closeModal();
      } else {
        alert(data.error || 'Failed to update goal.');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });
}

// -----------------------------
// Add Action Modal
// -----------------------------
function setupAddActionModal() {
  const addBtn = document.getElementById('add-action-btn');
  const modal = document.getElementById('add-action-modal');
  const closeBtn = document.getElementById('close-add-action-modal');
  const cancelBtn = document.getElementById('cancel-add-action');
  const form = document.getElementById('add-action-form');
  const titleInput = document.getElementById('action-title');

  function openModal() {
    modal.style.display = 'block';
    titleInput.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
  }

  addBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const description = document.getElementById('action-description').value.trim();
    const dueDate = document.getElementById('action-due-date').value || null;

    if (!title) return;

    const submitBtn = document.getElementById('submit-add-action');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/action-define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goalId: currentGoalId,
          title,
          description,
          dueDate,
          priority: 'medium',
          taskType: 'manual'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add to local state and re-render
        currentActions.unshift(data.action);
        currentProgress.total++;
        displayActions();
        displayProgress();
        updateCounts();
        closeModal();
      } else {
        alert(data.error || 'Failed to create action.');
      }
    } catch (error) {
      console.error('Error creating action:', error);
      alert('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Action';
    }
  });
}

// -----------------------------
// Goal Actions (Complete/Archive)
// -----------------------------
function setupGoalActions() {
  const completeBtn = document.getElementById('complete-goal-btn');
  const archiveBtn = document.getElementById('archive-goal-btn');

  completeBtn.addEventListener('click', async () => {
    if (!confirm('Mark this goal as completed?')) return;

    completeBtn.disabled = true;
    completeBtn.textContent = 'Completing...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/goal-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goalId: currentGoalId,
          state: 'completed'
        })
      });

      const data = await response.json();

      if (data.success) {
        currentGoal.state = 'completed';
        displayGoal();
      } else {
        alert(data.error || 'Failed to complete goal.');
      }
    } catch (error) {
      console.error('Error completing goal:', error);
      alert('Network error. Please try again.');
    } finally {
      completeBtn.disabled = false;
      completeBtn.textContent = 'Mark Complete';
    }
  });

  archiveBtn.addEventListener('click', async () => {
    const isArchived = currentGoal.state === 'archived';
    const newState = isArchived ? 'active' : 'archived';
    const confirmMsg = isArchived ? 'Unarchive this goal?' : 'Archive this goal?';

    if (!confirm(confirmMsg)) return;

    archiveBtn.disabled = true;
    archiveBtn.textContent = isArchived ? 'Unarchiving...' : 'Archiving...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/goal-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goalId: currentGoalId,
          state: newState
        })
      });

      const data = await response.json();

      if (data.success) {
        currentGoal.state = newState;
        displayGoal();
      } else {
        alert(data.error || 'Failed to update goal.');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Network error. Please try again.');
    } finally {
      archiveBtn.disabled = false;
      archiveBtn.textContent = currentGoal.state === 'archived' ? 'Unarchive' : 'Archive';
    }
  });
}

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  initializeUser();
  loadGoalDetail();
}

document.addEventListener('DOMContentLoaded', init);
