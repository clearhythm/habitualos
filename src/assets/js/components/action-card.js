//
// assets/js/components/action-card.js
// ------------------------------------------------------
// Reusable action card component
// Creates a card DOM element for displaying an action
// ------------------------------------------------------

import { formatDate, escapeHtml } from "/assets/js/utils/utils.js";

/**
 * Get icon for action taskType
 */
function getActionIcon(taskType) {
  const icons = {
    measurement: '📊',
    manual: '📄',
    interactive: '💬',
    review: '🔍',
  };
  return icons[taskType] || '📥';
}

/**
 * Get color based on assignedTo field
 */
function getAssignedToColor(assignedTo) {
  return assignedTo === 'agent' ? '#8b5cf6' : '#3b82f6';
}

/**
 * Truncate description to a max length
 */
function truncateDescription(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Create an action card element
 * @param {Object} action - The action data
 * @param {Function} onClick - Click handler function (receives action)
 * @returns {HTMLDivElement} The card element
 */
export function createActionCard(action, onClick) {
  const card = document.createElement('div');
  card.className = 'card card-clickable';
  card.style.cssText = 'cursor: pointer; position: relative; padding-left: 1.25rem;';

  // Add click handler
  if (onClick) {
    card.onclick = () => onClick(action);
  }

  // Icon based on taskType
  const icon = getActionIcon(action.taskType);

  // Colored left bar based on assignedTo
  const barColor = getAssignedToColor(action.assignedTo);

  // Created date
  const createdDate = action._createdAt ? formatDate(action._createdAt) : '';

  // Truncated description
  const truncatedDesc = truncateDescription(action.description);

  card.innerHTML = `
    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${barColor}; border-radius: 12px 0 0 12px;"></div>
    <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
      <span style="font-size: 1.25rem;">${icon}</span>
      <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">${escapeHtml(action.title)}</h3>
    </div>
    <p style="margin: 0 0 0.5rem; font-size: 0.875rem; color: #6b7280;">${escapeHtml(truncatedDesc)}</p>
    <span style="font-size: 0.75rem; color: #9ca3af;">${createdDate}</span>
  `;

  return card;
}

/**
 * Determine if action should open measurement chat
 */
export function isMeasurementAction(action) {
  const isMeasurement = action.taskType === 'measurement';
  const isCompleted = action.state === 'completed' || action.state === 'dismissed';
  return isMeasurement && !isCompleted && action.agentId;
}

/**
 * Handle click for measurement actions - redirects to agent chat
 */
export function handleMeasurementClick(action) {
  sessionStorage.setItem('measurementActionContext', JSON.stringify({
    actionId: action.id,
    title: action.title,
    taskType: action.taskType,
    taskConfig: action.taskConfig
  }));
  window.location.href = `/do/agent/?id=${action.agentId}#chat`;
}

/**
 * Determine if action should open review chat
 */
export function isReviewAction(action) {
  const isReview = action.taskType === 'review';
  const isCompleted = action.state === 'completed' || action.state === 'dismissed';
  return isReview && !isCompleted && action.agentId;
}

/**
 * Handle click for review actions - redirects to agent chat
 */
export function handleReviewClick(action) {
  sessionStorage.setItem('reviewActionContext', JSON.stringify({
    actionId: action.id,
    title: action.title,
    taskType: action.taskType,
    taskConfig: action.taskConfig
  }));
  window.location.href = `/do/agent/?id=${action.agentId}#chat`;
}

/**
 * Filter actions by filter type
 */
export function filterActions(actions, filter) {
  switch (filter) {
    case 'open':
      return actions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
    case 'completed':
      return actions.filter(a => a.state === 'completed' || a.state === 'dismissed');
    default:
      return actions;
  }
}

/**
 * Sort actions: blue (user) first, then purple (agent), each group by newest first
 */
export function sortActions(actions) {
  return [...actions].sort((a, b) => {
    const aIsAgent = (a.assignedTo || 'user') === 'agent';
    const bIsAgent = (b.assignedTo || 'user') === 'agent';

    // Blue (user) items first
    if (!aIsAgent && bIsAgent) return -1;
    if (aIsAgent && !bIsAgent) return 1;

    // Within same group, sort by newest first
    return new Date(b._createdAt) - new Date(a._createdAt);
  });
}
