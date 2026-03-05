//
// scripts/project.js
// ------------------------------------------------------
// Project detail page module - handles project viewing, goals, actions
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { getProjectDetails, listProjects } from '/assets/js/api/projects.js';
import { createAction } from '/assets/js/api/actions.js';
import { showActionModal } from '/assets/js/components/action-modal.js';

// -----------------------------
// State
// -----------------------------
let projectData = { project: null, agents: [], actions: [], goals: [] };
let allProjects = [];

// -----------------------------
// Helper Functions
// -----------------------------
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTimeline(timeline) {
  if (!timeline) return null;
  if (timeline === 'ongoing') return 'Ongoing';
  const date = new Date(timeline);
  if (isNaN(date.getTime())) return timeline;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// -----------------------------
// Render Functions
// -----------------------------
function renderGoals(goals) {
  const sectionEl = document.getElementById('goals-section');
  const listEl = document.getElementById('goals-list');
  const emptyEl = document.getElementById('goals-empty');

  if (!goals || goals.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  goals.forEach(goal => {
    const item = document.createElement('a');
    item.className = 'goal-item';
    item.href = `/do/goal/?id=${goal.id}`;

    const progress = goal.progress || { total: 0, completed: 0, percentage: 0 };
    const stateClass = `state-${goal.state}`;

    item.innerHTML = `
      <div class="goal-info">
        <h3 class="goal-name">${escapeHtml(goal.title || 'Untitled Goal')}</h3>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${progress.percentage}%"></div>
        </div>
        <div class="goal-meta">${progress.completed} of ${progress.total} actions (${progress.percentage}%)</div>
      </div>
      <span class="goal-state ${stateClass}">${goal.state}</span>
    `;

    listEl.appendChild(item);
  });
}

function renderAgents(agents) {
  const listEl = document.getElementById('agents-list');
  const emptyEl = document.getElementById('agents-empty');

  listEl.innerHTML = '';

  if (agents.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';

  agents.forEach(agent => {
    const item = document.createElement('a');
    item.className = 'agent-item';
    item.href = `/do/agent/?id=${agent.id}`;

    const badgeClass = agent.status === 'active' ? 'badge-active' :
                       agent.status === 'paused' ? 'badge-paused' : 'badge-completed';

    const cost = (agent.metrics?.totalCost || 0).toFixed(2);
    const actions = agent.metrics?.totalActions || 0;

    item.innerHTML = `
      <div class="item-info">
        <h3 class="item-name">${escapeHtml(agent.name || 'Untitled Agent')}</h3>
        <div class="item-meta">${actions} actions &bull; $${cost}</div>
      </div>
      <span class="item-badge ${badgeClass}">${agent.status}</span>
    `;

    listEl.appendChild(item);
  });
}

function renderActionsList(actions, listId, emptyId, filter = 'all') {
  const listEl = document.getElementById(listId);
  const emptyEl = document.getElementById(emptyId);

  listEl.innerHTML = '';

  // Filter actions
  let filteredActions = actions;
  if (filter === 'open') {
    filteredActions = actions.filter(a => !['completed', 'dismissed'].includes(a.state));
  } else if (filter === 'completed') {
    filteredActions = actions.filter(a => a.state === 'completed');
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
    item.style.cursor = 'pointer';

    const badgeClass = `badge-${action.state}`;
    const priorityText = action.priority === 'high' ? 'High' :
                         action.priority === 'low' ? 'Low' : 'Medium';

    // Show goal name if action belongs to a goal
    let metaText = `${priorityText} priority • ${action.taskType || 'scheduled'}`;
    if (action.goalId && projectData.goals) {
      const goal = projectData.goals.find(g => g.id === action.goalId);
      if (goal) {
        metaText = `${goal.title} • ${priorityText}`;
      }
    }

    item.innerHTML = `
      <div class="item-info">
        <h3 class="item-name">${escapeHtml(action.title || 'Untitled Action')}</h3>
        <div class="item-meta">${metaText}</div>
      </div>
      <span class="item-badge ${badgeClass}">${action.state}</span>
    `;

    item.addEventListener('click', () => {
      showActionModal(action, {
        onComplete: () => loadProject()
      });
    });

    listEl.appendChild(item);
  });
}

function renderOpenActions() {
  // Filter to ungrouped actions (no goalId) for open view
  const ungroupedActions = projectData.actions.filter(a => !a.goalId);
  renderActionsList(ungroupedActions, 'open-list', 'open-empty', 'open');
}

function renderCompletedActions(filter = 'completed') {
  renderActionsList(projectData.actions, 'completed-list', 'completed-empty', filter);
}

// -----------------------------
// View Navigation
// -----------------------------
function setupViewNavigation() {
  const viewLinks = document.querySelectorAll('.view-link');
  const views = document.querySelectorAll('.project-view');
  const moreLink = document.getElementById('project-more-link');

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

  if (moreLink) {
    moreLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('overview');
      history.replaceState(null, '', '#overview');
    });
  }

  const hash = window.location.hash.slice(1);
  if (['open', 'completed', 'agents', 'goals', 'overview'].includes(hash)) {
    switchView(hash);
  }
}

function setupCompletedFilter() {
  const filterEl = document.getElementById('completed-filter');
  if (filterEl) {
    filterEl.addEventListener('change', () => {
      renderCompletedActions(filterEl.value);
    });
  }
}

// -----------------------------
// Add Goal Modal
// -----------------------------
function setupAddGoalModal() {
  const addBtn = document.getElementById('add-goal-btn');
  const modal = document.getElementById('add-goal-modal');
  const closeBtn = document.getElementById('close-add-goal-modal');
  const cancelBtn = document.getElementById('cancel-add-goal');
  const form = document.getElementById('add-goal-form');
  const titleInput = document.getElementById('goal-title');

  if (!addBtn || !modal) return;

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
    const description = document.getElementById('goal-description').value.trim();

    if (!title) return;

    const submitBtn = document.getElementById('submit-add-goal');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const userId = getUserId();
      const response = await fetch('/.netlify/functions/goal-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectId: projectData.project.id,
          title,
          description: description || null
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add to local state with empty progress
        const newGoal = {
          ...data.goal,
          progress: { total: 0, completed: 0, percentage: 0 }
        };
        projectData.goals.unshift(newGoal);
        renderGoals(projectData.goals);
        document.getElementById('goals-count').textContent = projectData.goals.length;
        closeModal();
      } else {
        alert(data.error || 'Failed to create goal.');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Goal';
    }
  });
}

// -----------------------------
// Add Action Modal
// -----------------------------
async function loadAllProjects() {
  try {
    const userId = getUserId();
    const data = await listProjects(userId);
    if (data.success && data.projects) {
      allProjects = data.projects;
    }
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

function setupAddActionModal() {
  const modal = document.getElementById('add-action-modal');
  const openBtn = document.getElementById('add-action-btn');
  const closeBtn = document.getElementById('close-add-action-modal');
  const cancelBtn = document.getElementById('cancel-add-action');
  const form = document.getElementById('add-action-form');
  const titleInput = document.getElementById('action-title');
  const projectSelect = document.getElementById('action-project');
  const goalSelect = document.getElementById('action-goal');

  function populateProjectDropdown() {
    projectSelect.innerHTML = '';
    allProjects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || 'Untitled Project';
      if (projectData.project && project.id === projectData.project.id) {
        option.selected = true;
      }
      projectSelect.appendChild(option);
    });
  }

  function populateGoalDropdown() {
    goalSelect.innerHTML = '<option value="">No goal (ungrouped)</option>';
    if (projectData.goals) {
      projectData.goals.forEach(goal => {
        if (goal.state === 'active') {
          const option = document.createElement('option');
          option.value = goal.id;
          option.textContent = goal.title || 'Untitled Goal';
          goalSelect.appendChild(option);
        }
      });
    }
  }

  function openModal() {
    populateProjectDropdown();
    populateGoalDropdown();
    modal.style.display = 'block';
    titleInput.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-add-action');
    const title = titleInput.value.trim();
    const description = document.getElementById('action-description').value.trim();
    const selectedProjectId = projectSelect.value;
    const selectedGoalId = goalSelect.value || null;
    const dueDate = document.getElementById('action-due-date').value || null;

    if (!title) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const userId = getUserId();
      const result = await createAction({
        userId,
        projectId: selectedProjectId,
        goalId: selectedGoalId,
        title,
        description,
        dueDate,
        priority: 'medium',
        taskType: 'manual'
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create action');
      }

      // Reload to get updated data
      if (selectedProjectId === projectData.project.id) {
        await loadProject();
      }

      closeModal();
    } catch (error) {
      console.error('Error creating action:', error);
      alert(`Failed to create action: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Action';
    }
  });
}

// -----------------------------
// Load Project
// -----------------------------
async function loadProject() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error-state');
  const detailEl = document.getElementById('project-detail');

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');

  if (!projectId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const userId = getUserId();

    // Load project details and goals in parallel
    const [projectResponse, goalsResponse] = await Promise.all([
      getProjectDetails(projectId, userId),
      fetch(`/.netlify/functions/goals-list?userId=${userId}&projectId=${projectId}`).then(r => r.json())
    ]);

    loadingEl.style.display = 'none';

    if (!projectResponse.success || !projectResponse.project) {
      errorEl.style.display = 'block';
      return;
    }

    // Store data
    projectData = {
      project: projectResponse.project,
      agents: projectResponse.agents || [],
      actions: projectResponse.actions || [],
      goals: goalsResponse.success ? (goalsResponse.goals || []) : []
    };

    const project = projectData.project;
    detailEl.style.display = 'block';

    // Populate header
    document.getElementById('project-name').textContent = project.name || 'Untitled Project';
    const descText = project.description || '';
    document.getElementById('project-description-text').textContent = descText;

    const hasOverviewContent = project.timeline || (project.success_criteria && project.success_criteria.length > 0);
    if (!descText && !hasOverviewContent) {
      document.getElementById('project-more-link').style.display = 'none';
    }

    // Status badge
    const statusEl = document.getElementById('project-status');
    const statusClass = project.status === 'open' ? 'status-open' :
                        project.status === 'completed' ? 'status-completed' : 'status-archived';
    statusEl.className = `project-status ${statusClass}`;
    statusEl.textContent = project.status || 'open';

    // Update counts
    const ungroupedActions = projectData.actions.filter(a => !a.goalId);
    const openActions = ungroupedActions.filter(a => !['completed', 'dismissed'].includes(a.state));
    const completedActions = projectData.actions.filter(a => a.state === 'completed');

    document.getElementById('open-count').textContent = openActions.length;
    document.getElementById('completed-count').textContent = completedActions.length;
    document.getElementById('agents-count').textContent = projectData.agents.length;
    document.getElementById('goals-count').textContent = projectData.goals.length;

    // Overview: Timeline
    const timeline = formatTimeline(project.timeline);
    if (timeline) {
      document.getElementById('timeline-section').style.display = 'block';
      document.getElementById('project-timeline').textContent = timeline;
    }

    // Overview: Success criteria
    if (project.success_criteria && project.success_criteria.length > 0) {
      document.getElementById('criteria-section').style.display = 'block';
      const criteriaList = document.getElementById('project-criteria');
      criteriaList.innerHTML = '';
      project.success_criteria.forEach(criterion => {
        const li = document.createElement('li');
        li.textContent = criterion;
        criteriaList.appendChild(li);
      });
    }

    if (!timeline && (!project.success_criteria || project.success_criteria.length === 0)) {
      document.getElementById('empty-overview').style.display = 'block';
    }

    // Overview: Created date
    document.getElementById('project-created').textContent = formatDate(project._createdAt);

    // Render content
    renderGoals(projectData.goals);
    renderAgents(projectData.agents);
    renderOpenActions();
    renderCompletedActions();

    // Load all projects for dropdown
    await loadAllProjects();

    // Setup interactions
    setupViewNavigation();
    setupCompletedFilter();
    setupAddGoalModal();
    setupAddActionModal();

  } catch (error) {
    console.error('Error loading project:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  initializeUser();
  loadProject();
}

document.addEventListener('DOMContentLoaded', init);
