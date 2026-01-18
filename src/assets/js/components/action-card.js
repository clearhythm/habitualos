//
// assets/js/components/action-card.js
// ------------------------------------------------------
// Reusable action card component
// Creates a card DOM element for displaying an action
// ------------------------------------------------------

import { formatDate, formatState, escapeHtml, capitalize } from "/assets/js/utils/utils.js";

/**
 * Get icon for action taskType
 */
function getActionIcon(taskType) {
  const icons = {
    measurement: '📊',
    manual: '🧑',
    scheduled: '🤖'
  };
  return icons[taskType] || '⚡';
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
  card.style.cursor = 'pointer';

  // Add click handler
  if (onClick) {
    card.onclick = () => onClick(action);
  }

  // Icon based on taskType
  const icon = getActionIcon(action.taskType);

  // Show "Scheduled" with time for scheduled tasks
  let stateBadge;
  if (action.taskType === 'scheduled' && action.state === 'open' && action.scheduleTime) {
    const scheduledTime = formatDate(action.scheduleTime);
    stateBadge = `<span class="badge badge-scheduled">Scheduled: ${scheduledTime}</span>`;
  } else {
    stateBadge = `<span class="badge badge-${action.state}">${formatState(action.state)}</span>`;
  }

  // Created date
  const createdDate = action._createdAt ? formatDate(action._createdAt) : null;

  card.innerHTML = `
    <div class="flex flex-between" style="margin-bottom: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">${icon}</span>
        <h3 class="card-title" style="margin-bottom: 0;">${escapeHtml(action.title)}</h3>
      </div>
      ${stateBadge}
    </div>
    <div class="card-meta" style="margin-top: 0;">
      ${createdDate ? `<span style="color: #6b7280;">Created ${createdDate}</span>` : ''}
      ${action.priority ? `<span class="badge badge-${action.priority}" style="font-size: 0.75rem; padding: 0.125rem 0.375rem;">${capitalize(action.priority)}</span>` : ''}
    </div>
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
