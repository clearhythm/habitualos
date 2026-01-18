//
// assets/js/components/action-modal.js
// ------------------------------------------------------
// Reusable action modal component
// Creates a modal for viewing action details
// ------------------------------------------------------

import { formatDate, formatState, escapeHtml, capitalize } from "/assets/js/utils/utils.js";
import { getAction, completeAction as apiCompleteAction } from "/assets/js/api/actions.js";
import { getUserId } from "/assets/js/auth/auth.js";

let modalElement = null;
let onActionComplete = null;  // Callback for when action is completed

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
          <p id="modal-description" style="margin: 0; color: #6b7280; font-size: 0.95rem;"></p>
        </div>
        <button id="close-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 0; margin-left: 1rem; color: #9ca3af;">&times;</button>
      </div>
      <div id="modal-body" style="padding: 1.5rem;"></div>
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

  // Register global handlers
  window.copyActionContent = copyActionContent;
  window.completeActionFromModal = completeActionFromModal;

  return modalElement;
}

/**
 * Show action modal with action data
 * @param {Object} action - The action data
 * @param {Function} [onComplete] - Optional callback when action is completed
 */
export function showActionModal(action, onComplete = null) {
  ensureModal();
  onActionComplete = onComplete;

  // Populate modal
  document.getElementById('modal-title').textContent = action.title;
  document.getElementById('modal-description').textContent = action.description || '';

  const modalBody = document.getElementById('modal-body');
  let content = '';

  // Priority and state
  content += `<div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">`;
  content += `<span class="badge badge-${action.priority || 'medium'}">${capitalize(action.priority || 'medium')}</span>`;
  content += `<span class="badge badge-${action.state}">${formatState(action.state)}</span>`;
  if (action.taskType) {
    content += `<span class="badge">${capitalize(action.taskType)}</span>`;
  }
  content += `</div>`;

  // Manual actions (with content)
  if (action.taskType === 'manual' && action.content) {
    content += `<div style="margin-bottom: 1rem;">`;
    content += `<label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Content`;
    if (action.type) {
      content += ` <span style="background: #dbeafe; color: #1e40af; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-left: 0.5rem;">${action.type}</span>`;
    }
    content += `</label>`;
    content += `<pre style="padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.875rem; color: #4b5563; white-space: pre-wrap; font-family: 'Courier New', monospace; max-height: 400px; overflow-y: auto;">${escapeHtml(action.content)}</pre>`;
    content += `</div>`;

    content += `<div style="display: flex; gap: 0.5rem;">`;
    content += `<button onclick="copyActionContent('${action.id}')" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">📋 Copy</button>`;
    if (action.state !== 'completed') {
      content += `<button onclick="completeActionFromModal('${action.id}')" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">✓ Complete</button>`;
    }
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

  // Timestamps
  content += `<div style="font-size: 0.75rem; color: #9ca3af; margin-top: 1rem;">`;
  if (action._createdAt) {
    content += `Created ${formatDate(action._createdAt)}`;
  }
  if (action.completedAt) {
    content += ` • Completed ${formatDate(action.completedAt)}`;
  }
  content += `</div>`;

  modalBody.innerHTML = content;
  modalElement.style.display = 'block';
}

/**
 * Hide the action modal
 */
export function hideActionModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
  }
}

/**
 * Copy action content to clipboard
 */
async function copyActionContent(actionId) {
  const userId = getUserId();
  const data = await getAction(actionId, userId);

  if (data.success && data.action && data.action.content) {
    try {
      await navigator.clipboard.writeText(data.action.content);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  }
}

/**
 * Complete action from modal
 */
async function completeActionFromModal(actionId) {
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
