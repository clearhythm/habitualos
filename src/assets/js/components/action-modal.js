//
// assets/js/components/action-modal.js
// ------------------------------------------------------
// Reusable action modal component
// Creates a modal for viewing action details
// ------------------------------------------------------

import { formatDate, escapeHtml, capitalize } from "/assets/js/utils/utils.js";
import { getAction, completeAction as apiCompleteAction, dismissAction as apiDismissAction } from "/assets/js/api/actions.js";
import { getUserId } from "/assets/js/auth/auth.js";

let modalElement = null;
let currentAction = null;  // Store current action for chat navigation
let onActionComplete = null;  // Callback for when action is completed

/**
 * Get icon for action taskType
 */
function getActionIcon(taskType) {
  const icons = {
    measurement: '📊',
    manual: '📄',
    interactive: '💬',
  };
  return icons[taskType] || '📥';
}

/**
 * Initialize the modal (creates DOM element if needed)
 */
function ensureModal() {
  if (modalElement) return modalElement;

  modalElement = document.createElement('div');
  modalElement.id = 'action-modal';
  modalElement.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;';
  modalElement.innerHTML = `
    <div style="max-width: 800px; margin: 2rem auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: start; padding: 1.5rem; border-bottom: 1px solid #e5e7eb;">
        <div style="flex: 1;">
          <h2 id="modal-title" style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 600; color: #111;"></h2>
          <p id="modal-description" style="margin: 0 0 0.5rem 0; color: #6b7280; font-size: 0.95rem;"></p>
          <div style="font-size: 0.75rem; color: #9ca3af;">🤖 <span id="modal-agent-name"></span><span id="modal-date"></span></div>
        </div>
        <button id="close-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 0; margin-left: 1rem; color: #9ca3af;">&times;</button>
      </div>
      <div id="modal-body" style="padding: 1.5rem;"></div>
      <div id="modal-actions" style="display: flex; gap: 0.75rem; padding: 1.5rem; border-top: 1px solid #e5e7eb;"></div>
      <div id="modal-meta" style="padding: 0.75rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; gap: 0.5rem;"></div>
    </div>
  `;
  document.body.appendChild(modalElement);

  // Close modal handlers
  document.getElementById('close-modal').onclick = hideActionModal;
  modalElement.onclick = (e) => {
    if (e.target === modalElement) {
      hideActionModal();
    }
  };

  return modalElement;
}

/**
 * Show action modal with action data
 * @param {Object} action - The action data
 * @param {Object} [options] - Optional settings
 * @param {Function} [options.onComplete] - Callback when action is completed
 * @param {string} [options.agentName] - Name of the agent this action belongs to
 */
export function showActionModal(action, options = {}) {
  // Support legacy signature: showActionModal(action, onComplete)
  if (typeof options === 'function') {
    options = { onComplete: options };
  }
  const { onComplete = null, agentName = null } = options;
  ensureModal();
  currentAction = action;
  onActionComplete = onComplete;

  // Populate header
  document.getElementById('modal-title').textContent = action.title;
  document.getElementById('modal-description').textContent = action.description || '';

  // Agent name and date line
  const agentNameEl = document.getElementById('modal-agent-name');
  const dateStr = action._createdAt ? formatDate(action._createdAt) : '';
  if (agentName) {
    agentNameEl.textContent = agentName + ' · ';
  } else {
    agentNameEl.textContent = '';
  }
  document.getElementById('modal-date').textContent = dateStr;

  const modalBody = document.getElementById('modal-body');
  let content = '';

  // Content section for manual actions
  if (action.taskType === 'manual' && action.content) {
    const icon = getActionIcon(action.taskType);
    content += `<div style="margin-bottom: 1rem;">`;
    content += `<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">`;
    content += `<label style="font-weight: 500; color: #374151;">Content</label>`;
    if (action.type) {
      content += `<span style="background: #dbeafe; color: #1e40af; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${icon} ${action.type}</span>`;
    }
    content += `</div>`;
    content += `<pre style="padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.875rem; color: #4b5563; white-space: pre-wrap; font-family: 'Courier New', monospace; max-height: 400px; overflow-y: auto;">${escapeHtml(action.content)}</pre>`;
    content += `</div>`;
  }

  // Scheduled/interactive actions (with taskConfig)
  else if (action.taskConfig) {
    if (action.taskConfig.instructions) {
      content += `<div style="margin-bottom: 1rem;">`;
      content += `<label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Execution Instructions</label>`;
      content += `<div style="padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.875rem; color: #4b5563; white-space: pre-wrap;">${escapeHtml(action.taskConfig.instructions)}</div>`;
      content += `</div>`;
    }
    if (action.taskConfig.expectedOutput) {
      content += `<div style="margin-bottom: 1rem;">`;
      content += `<label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Expected Output</label>`;
      content += `<div style="padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.875rem; color: #4b5563; white-space: pre-wrap;">${escapeHtml(action.taskConfig.expectedOutput)}</div>`;
      content += `</div>`;
    }
  }

  modalBody.innerHTML = content;

  // Action buttons
  const modalActions = document.getElementById('modal-actions');
  let buttons = '';

  // Copy button - show for actions with content
  if (action.content) {
    buttons += `<button id="modal-copy-btn" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">📋 Copy</button>`;
  }

  // Chat button - always show (routes to agent chat or EA)
  buttons += `<button id="modal-chat-btn" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">💬 Chat</button>`;

  // Complete button - show if not completed/dismissed
  if (action.state !== 'completed' && action.state !== 'dismissed') {
    buttons += `<button id="modal-complete-btn" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">✓ Complete</button>`;
  }

  // Delete button - show if not completed/dismissed
  if (action.state !== 'completed' && action.state !== 'dismissed') {
    buttons += `<button id="modal-delete-btn" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Delete</button>`;
  }

  modalActions.innerHTML = buttons;

  // Add button event listeners
  document.getElementById('modal-copy-btn')?.addEventListener('click', copyActionContent);
  document.getElementById('modal-chat-btn')?.addEventListener('click', navigateToChat);
  document.getElementById('modal-complete-btn')?.addEventListener('click', completeActionFromModal);
  document.getElementById('modal-delete-btn')?.addEventListener('click', deleteActionFromModal);

  // Meta pills (left-aligned)
  const modalMeta = document.getElementById('modal-meta');
  let metaHtml = '';
  if (action.taskType) {
    metaHtml += `<span style="background: #f3f4f6; color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${capitalize(action.taskType)}</span>`;
  }
  if (action.state) {
    metaHtml += `<span style="background: #f3f4f6; color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${capitalize(action.state)}</span>`;
  }
  modalMeta.innerHTML = metaHtml;

  modalElement.style.display = 'block';
}

/**
 * Hide the action modal
 */
export function hideActionModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
  }
  currentAction = null;
}

/**
 * Copy action content to clipboard
 */
async function copyActionContent() {
  if (!currentAction || !currentAction.content) return;

  try {
    await navigator.clipboard.writeText(currentAction.content);
    const btn = document.getElementById('modal-copy-btn');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.style.background = '#10b981';
      btn.style.color = 'white';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#f3f4f6';
        btn.style.color = '#374151';
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
}

/**
 * Navigate to agent chat with action context
 * Routes to agent page if action has agentId, otherwise routes to EA
 */
function navigateToChat() {
  if (!currentAction) return;

  // Save values before hiding modal (which clears currentAction)
  const agentId = currentAction.agentId;
  const actionId = currentAction.id;

  // Store full action context in sessionStorage for chat
  sessionStorage.setItem('actionChatContext', JSON.stringify({
    actionId: currentAction.id,
    title: currentAction.title,
    description: currentAction.description,
    taskType: currentAction.taskType,
    taskConfig: currentAction.taskConfig,
    content: currentAction.content || null,
    type: currentAction.type || null,
    priority: currentAction.priority || 'medium',
    state: currentAction.state || 'unknown'
  }));

  hideActionModal();

  if (agentId) {
    // Route to agent chat
    const targetUrl = `/do/agent/?id=${agentId}#chat`;
    const currentPath = window.location.pathname + window.location.search;
    const targetPath = `/do/agent/?id=${agentId}`;

    if (currentPath === targetPath) {
      // Already on the agent page - manually trigger hash change and reload handling
      window.location.hash = 'chat';
      // Dispatch a custom event that agent.js can listen for
      window.dispatchEvent(new CustomEvent('actionChatContextReady'));
    } else {
      // Navigate to the agent page
      window.location.href = targetUrl;
    }
  } else {
    // Route to EA (Executive Agent) with action context
    window.location.href = `/do/ea/?action=${actionId}`;
  }
}

/**
 * Complete action from modal
 */
async function completeActionFromModal() {
  if (!currentAction) return;

  // Save ID before hiding modal (which clears currentAction)
  const actionId = currentAction.id;

  try {
    const userId = getUserId();
    const data = await apiCompleteAction(actionId, userId);

    if (!data.success) {
      throw new Error(data.error || 'Failed to complete action');
    }

    hideActionModal();

    // Call the completion callback if provided
    if (onActionComplete) {
      onActionComplete(actionId);
    }

    alert('Action completed!');
  } catch (error) {
    console.error('Error completing action:', error);
    alert(`Failed to complete action: ${error.message}`);
  }
}

/**
 * Delete action from modal (uses dismiss with standard reason)
 */
async function deleteActionFromModal() {
  if (!currentAction) return;

  // Confirm deletion
  if (!confirm(`Delete "${currentAction.title}"? This cannot be undone.`)) {
    return;
  }

  // Save ID before hiding modal (which clears currentAction)
  const actionId = currentAction.id;

  try {
    const userId = getUserId();
    const data = await apiDismissAction(actionId, userId, 'Deleted by user');

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete action');
    }

    hideActionModal();

    // Call the completion callback if provided (to refresh the list)
    if (onActionComplete) {
      onActionComplete(actionId);
    }

    alert('Action deleted!');
  } catch (error) {
    console.error('Error deleting action:', error);
    alert(`Failed to delete action: ${error.message}`);
  }
}
