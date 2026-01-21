//
// scripts/agent.js
// ------------------------------------------------------
// Agent detail page module - handles chat, actions, feed views
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { log } from '/assets/js/utils/log.js';
import { formatDate, escapeHtml, formatRuntime } from '/assets/js/utils/utils.js';
import { listActions, completeAction as apiCompleteAction, dismissAction as apiDismissAction } from '/assets/js/api/actions.js';
import { getAgent } from '/assets/js/api/agents.js';
import { createActionCard, filterActions, sortActions, isMeasurementAction } from '/assets/js/components/action-card.js';
import { showActionModal } from '/assets/js/components/action-modal.js';
import { showToast } from '/assets/js/components/chat-toast.js';

// -----------------------------
// State
// -----------------------------
let agentId = null;
let currentAgent = null;
let chatHistory = [];
let loadingMessageElement = null;
let currentChatId = null;
let draftActions = [];
let proposedAssets = [];
let currentDraftAction = null;
let currentProposedAsset = null;
let currentMeasurementActionId = null;
let currentMeasurementActionContext = null;
let actionsLoaded = false;
let actionsCache = [];

// -----------------------------
// DOM Elements (populated on init)
// -----------------------------
let chatMessages = null;
let chatMessagesContainer = null;
let chatForm = null;
let messageInput = null;
let sendButton = null;

// -----------------------------
// LocalStorage Keys
// -----------------------------
function getAgentChatKey() {
  return `agent-chat-${agentId}`;
}

function getAgentChatIdKey() {
  return `agent-chat-id-${agentId}`;
}

function getLastSavedIndexKey() {
  return `agent-chat-last-saved-${agentId}`;
}

function getDraftActionsKey() {
  return `draft-actions-${agentId}`;
}

// -----------------------------
// Chat History Management
// -----------------------------
function getAgentChatHistory() {
  try {
    const stored = localStorage.getItem(getAgentChatKey());
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    log('error', 'Error loading agent chat history:', e);
    return [];
  }
}

function saveAgentChatHistory(history) {
  try {
    localStorage.setItem(getAgentChatKey(), JSON.stringify(history));
  } catch (e) {
    log('error', 'Error saving agent chat history:', e);
  }
}

function clearAgentChatFromLocalStorage() {
  try {
    localStorage.removeItem(getAgentChatKey());
    localStorage.removeItem(getAgentChatIdKey());
    localStorage.removeItem(getLastSavedIndexKey());
  } catch (e) {
    log('error', 'Error clearing agent chat history:', e);
  }
}

// -----------------------------
// Chat ID Management (for append mode)
// -----------------------------
function getAgentChatId() {
  try {
    return localStorage.getItem(getAgentChatIdKey());
  } catch (e) {
    log('error', 'Error loading agent chat ID:', e);
    return null;
  }
}

function saveAgentChatId(chatId) {
  try {
    localStorage.setItem(getAgentChatIdKey(), chatId);
  } catch (e) {
    log('error', 'Error saving agent chat ID:', e);
  }
}

// -----------------------------
// Last Saved Index Management (for append mode)
// -----------------------------
function getLastSavedIndex() {
  try {
    const value = localStorage.getItem(getLastSavedIndexKey());
    return value ? parseInt(value, 10) : 0;
  } catch (e) {
    log('error', 'Error loading last saved index:', e);
    return 0;
  }
}

function saveLastSavedIndex(index) {
  try {
    localStorage.setItem(getLastSavedIndexKey(), String(index));
  } catch (e) {
    log('error', 'Error saving last saved index:', e);
  }
}

// -----------------------------
// Draft Actions Management
// -----------------------------
function getDraftActions() {
  try {
    const stored = localStorage.getItem(getDraftActionsKey());
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    log('error', 'Error loading draft actions:', e);
    return [];
  }
}

function saveDraftActions(actions) {
  try {
    localStorage.setItem(getDraftActionsKey(), JSON.stringify(actions));
  } catch (e) {
    log('error', 'Error saving draft actions:', e);
  }
}

// -----------------------------
// Assets Management
// -----------------------------
function getAssets() {
  try {
    const stored = localStorage.getItem(`assets-${agentId}`);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    log('error', 'Error loading assets:', e);
    return [];
  }
}

function updateAssetsCount() {
  // No-op: assets-count element no longer exists (replaced with Feed view)
}

// -----------------------------
// Chat UI Functions
// -----------------------------
function updateSendButton() {
  const hasContent = messageInput.value.trim().length > 0;
  sendButton.disabled = !hasContent;

  if (hasContent) {
    sendButton.style.background = '#2563eb';
    sendButton.style.cursor = 'pointer';
  } else {
    sendButton.style.background = '#ddd';
    sendButton.style.cursor = 'not-allowed';
  }
}

function showLoadingMessage() {
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'padding: 0.875rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5; background-color: #eff6ff; color: #333; align-self: flex-start; border-left: 3px solid #ddd; border-bottom-left-radius: 4px;';
  loadingDiv.innerHTML = '<span style="color: #999; font-style: italic;">Thinking...</span>';
  chatMessages.appendChild(loadingDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  loadingMessageElement = loadingDiv;
}

function hideLoadingMessage() {
  if (loadingMessageElement) {
    loadingMessageElement.remove();
    loadingMessageElement = null;
  }
}

function showActionContextIndicator(actionTitle) {
  // Remove existing indicator if any
  const existing = document.getElementById('action-context-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.id = 'action-context-indicator';
  indicator.style.cssText = 'align-self: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.5rem 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; color: #1e40af; display: flex; align-items: center; gap: 0.5rem;';
  indicator.innerHTML = `
    <span>💬 Discussing: <strong>${escapeHtml(actionTitle)}</strong></span>
    <button id="clear-action-context" style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 0 0.25rem; font-size: 1rem;">×</button>
  `;

  chatMessages.insertBefore(indicator, chatMessages.firstChild);

  document.getElementById('clear-action-context').onclick = () => {
    indicator.remove();
    currentMeasurementActionContext = null;
  };
}

function renderMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 0.875rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5;';

  if (role === 'assistant') {
    messageDiv.style.cssText += 'background-color: #eff6ff; color: #333; align-self: flex-start; border-left: 3px solid #2563eb; border-bottom-left-radius: 4px;';

    // Render markdown for assistant messages
    if (window.marked) {
      messageDiv.innerHTML = marked.parse(content);
    } else {
      messageDiv.textContent = content;
    }
  } else {
    messageDiv.style.cssText += 'background-color: #2563eb; color: white; align-self: flex-end; border-bottom-right-radius: 4px; white-space: pre-wrap;';
    messageDiv.textContent = content;
  }

  chatMessages.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// -----------------------------
// Firestore Chat Persistence
// -----------------------------
async function saveChatToFirestore(generatedAssets = [], generatedActions = []) {
  if (chatHistory.length === 0) return;

  try {
    const lastSavedIdx = getLastSavedIndex();
    const newMessages = chatHistory.slice(lastSavedIdx);

    // Nothing new to save
    if (newMessages.length === 0 && generatedAssets.length === 0 && generatedActions.length === 0) {
      return;
    }

    const existingChatId = getAgentChatId();
    const isAppend = existingChatId && lastSavedIdx > 0;
    const userId = getUserId();

    const response = await fetch('/.netlify/functions/agent-chat-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        agentId,
        messages: isAppend ? newMessages : chatHistory,
        generatedAssets,
        generatedActions,
        chatId: existingChatId,
        mode: isAppend ? 'append' : 'create'
      })
    });

    const data = await response.json();

    if (data.success) {
      if (!existingChatId && data.chatId) {
        currentChatId = data.chatId;
        saveAgentChatId(data.chatId); // Persist to localStorage
        log('debug', 'New chat created in Firestore:', data.chatId);
      } else {
        log('debug', 'Chat appended to Firestore:', existingChatId);
      }
      // Update last saved index
      saveLastSavedIndex(chatHistory.length);
    } else {
      log('error', 'Failed to save chat:', data.error);
    }
  } catch (error) {
    log('error', 'Error saving chat to Firestore:', error);
  }
}

function clearChatHistory() {
  chatHistory = [];
  currentChatId = null;
  clearAgentChatFromLocalStorage(); // Also clears chatId from localStorage
  chatMessages.innerHTML = '';

  // Re-render greeting
  const greeting = {
    role: 'assistant',
    content: `Ready to get to work? I can help suggest next steps, and we can work together to create assets or create actions I'll complete at a scheduled time. How would you like to begin?`,
    timestamp: new Date().toISOString()
  };
  chatHistory.push(greeting);
  saveAgentChatHistory(chatHistory);
  renderMessage('assistant', greeting.content);
}

// -----------------------------
// Draft Action Cards
// -----------------------------
function renderDraftActionCard(action) {
  const cardDiv = document.createElement('div');
  cardDiv.dataset.actionId = action.id;
  cardDiv.style.cssText = 'align-self: flex-start; max-width: 80%; width: 100%;';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'cursor: pointer; border: 2px dashed #fbbf24; background-color: #fffbeb; padding: 1rem; margin: 0.5rem 0;';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
      <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: #92400e;">${action.title}</h4>
      <span style="background: #fef3c7; color: #92400e; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Draft</span>
    </div>
    ${action.description ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #78350f;">${action.description}</p>` : ''}
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #a16207;">Click to refine or mark as defined</p>
  `;

  card.onclick = () => openDraftActionModal(action);

  cardDiv.appendChild(card);
  chatMessages.appendChild(cardDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function openDraftActionModal(action) {
  currentDraftAction = action;
  const modal = document.getElementById('draft-action-modal');

  document.getElementById('draft-modal-title').textContent = 'Define Action';
  document.getElementById('draft-title').value = action.title;
  document.getElementById('draft-description').value = action.description || '';
  document.getElementById('draft-priority').value = action.priority || 'medium';

  document.getElementById('draft-title').disabled = false;
  document.getElementById('draft-description').disabled = false;
  document.getElementById('draft-priority').disabled = false;

  const taskConfigSection = document.getElementById('task-config-section');
  const manualContentSection = document.getElementById('manual-content-section');

  if (action.taskType === 'manual' && action.content) {
    taskConfigSection.style.display = 'none';
    manualContentSection.style.display = 'block';
    document.getElementById('draft-content').textContent = action.content;
    document.getElementById('manual-type-badge').textContent = action.type || 'text';
  } else if (action.taskConfig && (action.taskConfig.instructions || action.taskConfig.expectedOutput)) {
    manualContentSection.style.display = 'none';
    taskConfigSection.style.display = 'block';
    document.getElementById('draft-instructions').textContent = action.taskConfig.instructions || 'No instructions provided';
    document.getElementById('draft-expected-output').textContent = action.taskConfig.expectedOutput || 'No expected output specified';
  } else {
    taskConfigSection.style.display = 'none';
    manualContentSection.style.display = 'none';
  }

  // Show draft mode buttons
  document.getElementById('delete-draft-btn').style.display = 'block';
  document.getElementById('define-action-btn').style.display = 'block';
  document.getElementById('cancel-draft-btn').style.display = 'block';
  document.getElementById('delete-action-btn').style.display = 'none';
  document.getElementById('copy-action-btn').style.display = 'none';
  document.getElementById('complete-action-btn').style.display = 'none';
  document.getElementById('close-action-btn').style.display = 'none';

  modal.style.display = 'block';
}

function closeDraftActionModal() {
  const modal = document.getElementById('draft-action-modal');
  modal.style.display = 'none';
  currentDraftAction = null;
  delete modal.dataset.actionId;

  document.getElementById('draft-title').disabled = false;
  document.getElementById('draft-description').disabled = false;
  document.getElementById('draft-priority').disabled = false;

  document.getElementById('delete-draft-btn').style.display = 'block';
  document.getElementById('define-action-btn').style.display = 'block';
  document.getElementById('cancel-draft-btn').textContent = 'Cancel';
}

function deleteDraftAction() {
  if (!currentDraftAction) return;

  if (!confirm('Are you sure you want to delete this draft action? This cannot be undone.')) {
    return;
  }

  draftActions = draftActions.filter(a => a.id !== currentDraftAction.id);
  saveDraftActions(draftActions);

  const cardElement = document.querySelector(`[data-action-id="${currentDraftAction.id}"]`);
  if (cardElement) {
    cardElement.remove();
  }

  closeDraftActionModal();
}

async function markAsDefinedFromModal() {
  if (!currentDraftAction) return;

  const title = document.getElementById('draft-title').value.trim();
  const description = document.getElementById('draft-description').value.trim();
  const priority = document.getElementById('draft-priority').value;

  if (!title || !description) {
    alert('Title and description are required');
    return;
  }

  try {
    const userId = getUserId();
    const payload = {
      userId,
      agentId,
      title,
      description,
      priority,
      taskType: currentDraftAction.taskType || 'scheduled',
      taskConfig: currentDraftAction.taskConfig || {}
    };

    if (currentDraftAction.taskType === 'manual') {
      payload.type = currentDraftAction.type;
      payload.content = currentDraftAction.content;
    }

    const response = await fetch('/.netlify/functions/action-define', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to define action');
    }

    draftActions = draftActions.filter(a => a.id !== currentDraftAction.id);
    saveDraftActions(draftActions);

    const cardElement = document.querySelector(`[data-action-id="${currentDraftAction.id}"]`);
    if (cardElement) {
      cardElement.remove();
    }

    closeDraftActionModal();
    clearChatHistory();
    alert('Action defined! It will appear in your Actions list.');
    window.dispatchEvent(new Event('reloadActions'));

  } catch (error) {
    log('error', 'Error defining action:', error);
    alert(`Failed to define action: ${error.message}`);
  }
}

// -----------------------------
// Proposed Asset Cards
// -----------------------------
function renderProposedAssetCard(asset) {
  const cardDiv = document.createElement('div');
  cardDiv.dataset.assetId = asset.id;
  cardDiv.style.cssText = 'align-self: flex-start; max-width: 80%; width: 100%;';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'cursor: pointer; border: 2px dashed #3b82f6; background-color: #eff6ff; padding: 1rem; margin: 0.5rem 0;';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">📄</span>
        <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: #1e40af;">${escapeHtml(asset.title)}</h4>
      </div>
      <span style="background: #dbeafe; color: #1e40af; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${asset.type}</span>
    </div>
    ${asset.description ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #1e3a8a;">${escapeHtml(asset.description)}</p>` : ''}
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #2563eb;">Click to view, copy, or save</p>
  `;

  card.onclick = () => openProposedAssetModal(asset.id);

  cardDiv.appendChild(card);
  chatMessages.appendChild(cardDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function openProposedAssetModal(assetId) {
  const asset = proposedAssets.find(a => a.id === assetId);
  if (!asset) return;

  currentProposedAsset = asset;
  const modal = document.getElementById('proposed-asset-modal');

  document.getElementById('asset-modal-title').textContent = asset.title;
  document.getElementById('asset-modal-description').textContent = asset.description;
  document.getElementById('asset-modal-type').textContent = asset.type;
  document.getElementById('asset-modal-content').textContent = asset.content;

  modal.style.display = 'block';
}

function closeProposedAssetModal() {
  const modal = document.getElementById('proposed-asset-modal');
  modal.style.display = 'none';
  currentProposedAsset = null;
}

function deleteProposedAsset() {
  if (!currentProposedAsset) return;

  if (!confirm('Are you sure you want to delete this proposed asset? This cannot be undone.')) {
    return;
  }

  proposedAssets = proposedAssets.filter(a => a.id !== currentProposedAsset.id);

  const cardElement = document.querySelector(`[data-asset-id="${currentProposedAsset.id}"]`);
  if (cardElement) {
    cardElement.remove();
  }

  closeProposedAssetModal();
}

function copyAssetFromModal(event) {
  if (!currentProposedAsset) return;

  navigator.clipboard.writeText(currentProposedAsset.content).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = '#10b981';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '#f3f4f6';
    }, 2000);
  }).catch(err => {
    log('error', 'Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

async function saveAssetFromModal() {
  if (!currentProposedAsset) return;

  const savedAsset = {
    ...currentProposedAsset,
    id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    state: 'saved',
    agentId: agentId,
    createdAt: new Date().toISOString()
  };

  const assets = getAssets();
  assets.unshift(savedAsset);
  localStorage.setItem(`assets-${agentId}`, JSON.stringify(assets));

  proposedAssets = proposedAssets.filter(a => a.id !== currentProposedAsset.id);
  updateAssetsCount();
  closeProposedAssetModal();
  clearChatHistory();
  alert('Asset saved!');

  if (document.getElementById('view-feed')?.style.display === 'block') {
    renderFeed();
  }

  if (document.getElementById('view-actions')?.style.display === 'block') {
    await loadActions();
  }
}

// -----------------------------
// Feed View
// -----------------------------
function renderFeed() {
  const container = document.getElementById('feed-list');
  const emptyState = document.getElementById('feed-empty-state');
  const showCompletedOnly = document.getElementById('show-completed-feed')?.checked || false;

  const actions = actionsCache;
  const filteredActions = showCompletedOnly ?
    actions.filter(a => a.state === 'completed') :
    actions;

  if (filteredActions.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';

  const sortedActions = [...filteredActions].sort((a, b) => {
    const aTime = new Date(a.completedAt || a._createdAt);
    const bTime = new Date(b.completedAt || b._createdAt);
    return bTime - aTime;
  });

  container.innerHTML = sortedActions.map(action => {
    const isCompleted = action.state === 'completed';
    const icon = action.taskType === 'manual' ? '✅' :
                 action.taskType === 'scheduled' ? '🤖' : '⚡';
    const timestamp = isCompleted ? action.completedAt : action._createdAt;
    const eventText = isCompleted ?
      `You completed action <strong>${escapeHtml(action.title)}</strong>` :
      `You created action <strong>${escapeHtml(action.title)}</strong>`;

    return `
      <div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 1rem; ${isCompleted ? '' : 'opacity: 0.6;'}">
        <div style="font-size: 1.5rem;">${icon}</div>
        <div style="flex: 1;">
          <div style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem;">
            ${formatDate(timestamp)}
          </div>
          <div style="font-size: 0.95rem; color: #374151;">
            ${eventText}
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          ${action.taskType === 'manual' && action.content ? `
            <button onclick="viewActionModal('${action.id}')" style="padding: 0.375rem 0.75rem; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">
              View
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------
// Actions Management
// -----------------------------
async function loadActions() {
  const userId = getUserId();
  log('debug', '[loadActions] Fetching actions for userId:', userId, 'agentId:', agentId);

  try {
    const data = await listActions(userId, agentId);

    if (!data.success) {
      throw new Error(data.error || 'Failed to load actions');
    }

    actionsCache = data.actions || [];
    log('debug', '[loadActions] Loaded', actionsCache.length, 'actions');
    renderActions();
    updateActionsCount();

  } catch (error) {
    log('error', '[actions] Error loading actions:', error);
  }
}

function renderActions() {
  const grid = document.getElementById('agent-actions-grid');
  const filter = document.getElementById('actions-filter').value;

  // Apply filter (open/all/completed)
  let filteredActions = filterActions(actionsCache, filter);

  // Apply sorting (blue first, then purple, each newest first)
  filteredActions = sortActions(filteredActions);

  // Clear grid
  grid.innerHTML = '';

  if (filteredActions.length === 0) {
    grid.innerHTML = '<div style="text-align: center; padding: 3rem 1rem; color: #6b7280; grid-column: 1 / -1;"><p style="font-size: 1.125rem; margin-bottom: 0.5rem;">No actions yet</p><p style="font-size: 0.875rem;">Actions you define will appear here</p></div>';
    return;
  }

  // Click handler for actions
  const handleActionClick = (action) => {
    if (isMeasurementAction(action)) {
      openMeasurementChat(action.id);
    } else {
      showActionModal(action, {
        agentName: currentAgent?.name,
        onComplete: async () => {
          await loadActions();
        }
      });
    }
  };

  // Add all filtered and sorted actions using the shared card component
  filteredActions.forEach(action => {
    const card = createActionCard(action, handleActionClick);
    const isCompleted = action.state === 'completed' || action.state === 'dismissed';
    if (isCompleted) {
      card.style.opacity = '0.7';
    }
    grid.appendChild(card);
  });
}

function updateActionsCount() {
  const activeCount = actionsCache.filter(a => a.state !== 'completed' && a.state !== 'dismissed').length;
  const completedCount = actionsCache.filter(a => a.state === 'completed').length;
  const totalCount = actionsCache.filter(a => a.state !== 'dismissed').length;

  // Update header count (open actions)
  document.getElementById('actions-count').textContent = activeCount;

  // Update settings card count (completed/total)
  const settingsActions = document.getElementById('settings-agent-actions');
  if (settingsActions) {
    settingsActions.textContent = `${completedCount}/${totalCount}`;
  }
}

// -----------------------------
// Action Modal (View Mode)
// -----------------------------
function viewActionModal(actionId) {
  const action = actionsCache.find(a => a.id === actionId);
  if (!action) return;

  const modal = document.getElementById('draft-action-modal');
  const taskConfigSection = document.getElementById('task-config-section');
  const manualContentSection = document.getElementById('manual-content-section');

  const titleField = document.getElementById('draft-title');
  const descField = document.getElementById('draft-description');
  const priorityField = document.getElementById('draft-priority');

  titleField.value = action.title;
  descField.value = action.description || '';
  priorityField.value = action.priority || 'medium';

  titleField.disabled = true;
  descField.disabled = true;
  priorityField.disabled = true;

  if (action.taskType === 'manual' && action.content) {
    taskConfigSection.style.display = 'none';
    manualContentSection.style.display = 'block';
    document.getElementById('draft-content').textContent = action.content;
    document.getElementById('manual-type-badge').textContent = action.type || 'text';
  } else if (action.taskConfig) {
    manualContentSection.style.display = 'none';
    taskConfigSection.style.display = 'block';
    document.getElementById('draft-instructions').textContent = action.taskConfig.instructions || 'No instructions provided';
    document.getElementById('draft-expected-output').textContent = action.taskConfig.expectedOutput || 'No expected output specified';
  } else {
    taskConfigSection.style.display = 'none';
    manualContentSection.style.display = 'none';
  }

  document.getElementById('draft-modal-title').textContent = 'View Action';

  document.getElementById('delete-draft-btn').style.display = 'none';
  document.getElementById('define-action-btn').style.display = 'none';
  document.getElementById('cancel-draft-btn').style.display = 'none';

  document.getElementById('delete-action-btn').style.display = 'block';
  document.getElementById('copy-action-btn').style.display = action.content ? 'block' : 'none';
  document.getElementById('complete-action-btn').style.display = action.state === 'completed' ? 'none' : 'block';
  document.getElementById('close-action-btn').style.display = 'block';

  modal.dataset.actionId = actionId;
  modal.style.display = 'block';
}

// -----------------------------
// Action Operations
// -----------------------------
function copyActionContent(actionId) {
  const action = actionsCache.find(a => a.id === actionId);
  if (!action || !action.content) return;

  navigator.clipboard.writeText(action.content).then(() => {
    alert('Copied to clipboard!');
  }).catch(err => {
    log('error', 'Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

async function completeAction(actionId) {
  try {
    const userId = getUserId();
    const data = await apiCompleteAction(actionId, userId);

    if (!data.success) {
      throw new Error(data.error || 'Failed to complete action');
    }

    await loadActions();

    if (document.getElementById('view-feed')?.style.display === 'block') {
      renderFeed();
    }

    alert('Action completed!');

  } catch (error) {
    log('error', '[actions] Error completing action:', error);
    alert(`Failed to complete action: ${error.message}`);
  }
}

async function deleteAction(actionId) {
  try {
    const userId = getUserId();
    const data = await apiDismissAction(actionId, userId, 'User deleted from UI');

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete action');
    }

    await loadActions();

    if (document.getElementById('view-feed')?.style.display === 'block') {
      renderFeed();
    }

    alert('Action deleted!');

  } catch (error) {
    log('error', '[actions] Error deleting action:', error);
    alert(`Failed to delete action: ${error.message}`);
  }
}

// -----------------------------
// Measurement Chat
// -----------------------------
async function openMeasurementChat(actionId) {
  const action = actionsCache.find(a => a.id === actionId);
  if (!action || action.taskType !== 'measurement') return;

  currentMeasurementActionId = actionId;
  currentMeasurementActionContext = {
    actionId: action.id,
    title: action.title,
    taskType: action.taskType,
    taskConfig: action.taskConfig
  };

  const chatLink = document.querySelector('a[data-view="chat"]');
  if (chatLink) chatLink.click();

  chatHistory = [];
  clearAgentChatFromLocalStorage();
  chatMessages.innerHTML = '';

  const initialMessage = `I'm ready for my ${action.title} check-in.`;

  const userMessage = {
    role: 'user',
    content: initialMessage,
    timestamp: new Date().toISOString()
  };
  renderMessage('user', initialMessage);
  chatHistory.push(userMessage);
  saveAgentChatHistory(chatHistory);

  showLoadingMessage();

  try {
    const userId = getUserId();
    const response = await fetch('/.netlify/functions/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        agentId,
        message: initialMessage,
        chatHistory: [],
        actionContext: currentMeasurementActionContext
      })
    });

    const data = await response.json();
    hideLoadingMessage();

    if (data.success) {
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      renderMessage('assistant', data.response);
      chatHistory.push(assistantMessage);
      saveAgentChatHistory(chatHistory);
    } else {
      log('error', 'Error starting measurement chat:', data.error);
    }
  } catch (error) {
    log('error', 'Error starting measurement chat:', error);
    hideLoadingMessage();
  }
}

async function startMeasurementCheckIn(actionContext) {
  chatHistory = [];
  clearAgentChatFromLocalStorage();
  chatMessages.innerHTML = '';

  const initialMessage = `I'm ready for my ${actionContext.title} check-in.`;

  const userMessage = {
    role: 'user',
    content: initialMessage,
    timestamp: new Date().toISOString()
  };
  renderMessage('user', initialMessage);
  chatHistory.push(userMessage);
  saveAgentChatHistory(chatHistory);

  showLoadingMessage();

  try {
    const userId = getUserId();
    const response = await fetch('/.netlify/functions/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        agentId,
        message: initialMessage,
        chatHistory: [],
        actionContext: actionContext
      })
    });

    const data = await response.json();
    hideLoadingMessage();

    if (data.success) {
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      renderMessage('assistant', data.response);
      chatHistory.push(assistantMessage);
      saveAgentChatHistory(chatHistory);
    } else {
      log('error', 'Error starting measurement chat:', data.error);
    }
  } catch (error) {
    log('error', 'Error starting measurement chat:', error);
    hideLoadingMessage();
  }
}

// -----------------------------
// View Switching
// -----------------------------
async function ensureActionsLoaded() {
  log('debug', '[ensureActionsLoaded] Called, actionsLoaded:', actionsLoaded);
  if (actionsLoaded) return;
  log('debug', '[ensureActionsLoaded] Loading actions...');
  await loadActions();
  actionsLoaded = true;
}

async function switchToView(view) {
  log('debug', '[switchToView] Switching to view:', view);

  document.querySelectorAll('.agent-view').forEach(v => {
    v.style.display = 'none';
  });

  document.querySelectorAll('.view-link').forEach(l => {
    l.style.color = '#6b7280';
    l.style.fontWeight = 'normal';
  });

  const activeLink = document.querySelector(`.view-link[data-view="${view}"]`);
  if (activeLink) {
    activeLink.style.color = '#2563eb';
    activeLink.style.fontWeight = '600';
  }

  const viewElement = document.getElementById(`view-${view}`);
  if (viewElement) {
    // Chat view needs flex display for scrollable layout
    viewElement.style.display = view === 'chat' ? 'flex' : 'block';
  }

  if (view === 'chat') {
    messageInput?.focus();
  } else if (view === 'actions') {
    log('debug', '[switchToView] Calling ensureActionsLoaded for actions view');
    await ensureActionsLoaded();
    renderActions();
  } else if (view === 'feed') {
    log('debug', '[switchToView] Calling ensureActionsLoaded for feed view');
    await ensureActionsLoaded();
    renderFeed();
  }

  window.scrollTo(0, 0);
}

async function initializeViewFromHash() {
  const hash = window.location.hash.substring(1);
  const validViews = ['chat', 'actions', 'feed', 'settings'];

  // Handle measurement action context (auto-starts check-in)
  const measurementContextStr = sessionStorage.getItem('measurementActionContext');
  if (measurementContextStr && hash === 'chat') {
    try {
      const actionContext = JSON.parse(measurementContextStr);
      sessionStorage.removeItem('measurementActionContext');

      currentMeasurementActionId = actionContext.actionId;
      currentMeasurementActionContext = actionContext;

      await switchToView('chat');

      setTimeout(() => {
        startMeasurementCheckIn(actionContext);
      }, 100);
      return;
    } catch (e) {
      log('error', 'Error parsing measurement context:', e);
      sessionStorage.removeItem('measurementActionContext');
    }
  }

  // Handle general action chat context (from modal Chat button)
  const actionChatContextStr = sessionStorage.getItem('actionChatContext');
  if (actionChatContextStr && hash === 'chat') {
    try {
      const actionContext = JSON.parse(actionChatContextStr);
      sessionStorage.removeItem('actionChatContext');

      // Store context so it can be passed to agent-chat API
      currentMeasurementActionContext = actionContext;

      await switchToView('chat');

      // Show context indicator (user can type whatever they want)
      showActionContextIndicator(actionContext.title);
      return;
    } catch (e) {
      log('error', 'Error parsing action chat context:', e);
      sessionStorage.removeItem('actionChatContext');
    }
  }

  const view = validViews.includes(hash) ? hash : 'chat';
  await switchToView(view);
}

// -----------------------------
// Chat Form Handler
// -----------------------------
async function handleChatSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  const userMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  renderMessage('user', message);
  chatHistory.push(userMessage);
  saveAgentChatHistory(chatHistory);

  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;
  sendButton.style.background = '#ddd';
  sendButton.style.cursor = 'not-allowed';

  showLoadingMessage();

  try {
    const userId = getUserId();
    const response = await fetch('/.netlify/functions/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        agentId,
        message,
        chatHistory: chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        actionContext: currentMeasurementActionContext
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get response');
    }

    hideLoadingMessage();

    const assistantMessage = {
      role: 'assistant',
      content: data.response,
      timestamp: new Date().toISOString()
    };
    renderMessage('assistant', data.response);
    chatHistory.push(assistantMessage);
    saveAgentChatHistory(chatHistory);

    // Handle draft actions
    if (data.hasDraftActions && data.draftActions) {
      draftActions = [...draftActions, ...data.draftActions];
      saveDraftActions(draftActions);

      data.draftActions.forEach(action => {
        renderDraftActionCard(action);
      });

      const actionIds = data.draftActions.map(a => a.id);
      saveChatToFirestore([], actionIds);
    }

    // Handle proposed assets
    if (data.hasProposedAsset && data.proposedAsset) {
      proposedAssets.push(data.proposedAsset);
      renderProposedAssetCard(data.proposedAsset);
      saveChatToFirestore([data.proposedAsset.id], []);
    }

    // Handle measurement check-in completion
    if (data.hasMeasurement && data.measurementData && currentMeasurementActionId) {
      try {
        const measurementResponse = await fetch('/.netlify/functions/measurement-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            agentId,
            actionId: currentMeasurementActionId,
            dimensions: data.measurementData.dimensions,
            notes: data.measurementData.notes || null
          })
        });

        const measurementResult = await measurementResponse.json();

        if (measurementResult.success) {
          await completeAction(currentMeasurementActionId);

          const completionMessage = {
            role: 'system',
            content: '✓ Check-in recorded',
            timestamp: new Date().toISOString()
          };
          renderMessage('system', completionMessage.content);
        } else {
          log('error', 'Failed to store measurement:', measurementResult.error);
        }
      } catch (err) {
        log('error', 'Error storing measurement:', err);
      } finally {
        currentMeasurementActionId = null;
        currentMeasurementActionContext = null;
      }
    }

  } catch (error) {
    log('error', 'Error sending message:', error);
    hideLoadingMessage();

    const errorMessage = {
      role: 'assistant',
      content: "I'm having trouble connecting right now. Could you try again?",
      timestamp: new Date().toISOString()
    };
    renderMessage('assistant', errorMessage.content);
    chatHistory.push(errorMessage);
    saveAgentChatHistory(chatHistory);
  }
}

// -----------------------------
// Agent Data Loading
// -----------------------------
async function loadAgentData() {
  const loadingEl = document.getElementById('loading-agent');
  const errorEl = document.getElementById('agent-error');
  const detailEl = document.getElementById('agent-detail');

  try {
    const userId = getUserId();
    const data = await getAgent(agentId, userId);

    if (!data.success || !data.agent) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      return;
    }

    const agent = data.agent;
    currentAgent = agent;

    // Populate header
    document.getElementById('agent-name').textContent = agent.name || 'Untitled Agent';

    // Truncate goal for header
    const goalText = agent.instructions?.goal || 'No goal defined';
    const maxLength = 120;
    if (goalText.length > maxLength) {
      document.getElementById('agent-goal-short').innerHTML =
        goalText.substring(0, maxLength) + '... ' +
        '<a href="#settings" id="goal-more-link" style="color: #2563eb; text-decoration: none;">more</a>';
    } else {
      document.getElementById('agent-goal-short').textContent = goalText;
      document.getElementById('goal-more-link')?.remove();
    }

    // Populate settings view
    document.getElementById('agent-goal').textContent = goalText;

    if (agent.instructions?.success_criteria?.length > 0) {
      document.getElementById('success-criteria-section').style.display = 'block';
      const ul = document.getElementById('agent-success-criteria');
      ul.innerHTML = agent.instructions.success_criteria.map(c => `<li>${escapeHtml(c)}</li>`).join('');
    }

    if (agent.instructions?.timeline) {
      document.getElementById('timeline-section').style.display = 'block';
      document.getElementById('agent-timeline').textContent = agent.instructions.timeline;
    }

    // Settings card metrics
    document.getElementById('settings-agent-model').textContent = agent.model || 'Sonnet 4.5';
    document.getElementById('settings-agent-runtime').textContent = formatRuntime(agent._createdAt);
    document.getElementById('settings-agent-cost').textContent = `$${(agent.metrics?.totalCost || 0).toFixed(2)}`;

    const createdDate = new Date(agent._createdAt);
    const now = new Date();
    const daysSinceCreated = Math.max(1, Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)));
    const dailyAvgCost = (agent.metrics?.totalCost || 0) / daysSinceCreated;
    const projectedCost = (dailyAvgCost * 30).toFixed(2);
    document.getElementById('settings-agent-projected').textContent = `~$${projectedCost}/mo`;

    // Settings card actions count will be updated when actions load
    // Don't use stored metrics here as they can drift from actual counts
    document.getElementById('settings-agent-actions').textContent = '...';

    // Header actions count starts at "0" from HTML, will be updated when actions load
    // Don't set from metrics as they can be incorrect (causing negative numbers)

    // Status badge
    const statusBadge = document.getElementById('settings-agent-status-badge');
    statusBadge.textContent = agent.status?.toUpperCase() || 'ACTIVE';
    statusBadge.className = `badge badge-${agent.status === 'active' ? 'open' : agent.status === 'paused' ? 'completed' : 'dismissed'}`;

    // Pause button
    const pauseBtn = document.getElementById('settings-pause-button');
    pauseBtn.textContent = agent.status === 'paused' ? 'Resume' : 'Pause';
    pauseBtn.className = `btn btn-sm ${agent.status === 'paused' ? 'btn-primary' : 'btn-secondary'}`;

    // Show detail view (use flex for proper layout)
    loadingEl.style.display = 'none';
    detailEl.style.display = 'flex';

    // Dispatch event for chat initialization
    window.dispatchEvent(new CustomEvent('agentLoaded', { detail: agent }));

  } catch (error) {
    log('error', 'Error loading agent:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// -----------------------------
// Event Listeners Setup
// -----------------------------
function setupEventListeners() {
  // Draft action modal
  document.getElementById('close-draft-modal-header')?.addEventListener('click', closeDraftActionModal);
  document.getElementById('cancel-draft-btn')?.addEventListener('click', closeDraftActionModal);
  document.getElementById('delete-draft-btn')?.addEventListener('click', deleteDraftAction);
  document.getElementById('define-action-btn')?.addEventListener('click', markAsDefinedFromModal);

  // Proposed asset modal
  document.getElementById('close-asset-modal-header')?.addEventListener('click', closeProposedAssetModal);
  document.getElementById('delete-asset-btn')?.addEventListener('click', deleteProposedAsset);
  document.getElementById('copy-asset-btn')?.addEventListener('click', copyAssetFromModal);
  document.getElementById('save-asset-btn')?.addEventListener('click', saveAssetFromModal);

  // View mode action buttons
  document.getElementById('close-action-btn')?.addEventListener('click', closeDraftActionModal);
  document.getElementById('copy-action-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('draft-action-modal');
    const actionId = modal.dataset.actionId;
    if (actionId) copyActionContent(actionId);
  });
  document.getElementById('complete-action-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('draft-action-modal');
    const actionId = modal.dataset.actionId;
    if (actionId) {
      await completeAction(actionId);
      closeDraftActionModal();
    }
  });
  document.getElementById('delete-action-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('draft-action-modal');
    const actionId = modal.dataset.actionId;
    if (actionId && confirm('Are you sure you want to delete this action?')) {
      await deleteAction(actionId);
      closeDraftActionModal();
    }
  });

  // Feed checkbox
  document.getElementById('show-completed-feed')?.addEventListener('change', () => {
    renderFeed();
  });

  // Save chat button
  document.getElementById('save-chat-btn')?.addEventListener('click', async () => {
    if (chatHistory.length === 0) {
      showToast('No conversation to save.', { type: 'info' });
      return;
    }

    const saveBtn = document.getElementById('save-chat-btn');
    const originalText = saveBtn.textContent;

    // Determine which messages are new (not yet saved)
    const lastSavedIdx = getLastSavedIndex();
    const newMessages = chatHistory.slice(lastSavedIdx);

    if (newMessages.length === 0) {
      showToast('Already saved.', { type: 'info' });
      return;
    }

    const existingChatId = getAgentChatId();
    const isAppend = existingChatId && lastSavedIdx > 0;

    try {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const userId = getUserId();

      const response = await fetch('/.netlify/functions/agent-chat-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          agentId,
          messages: isAppend ? newMessages : chatHistory,
          generatedAssets: [],
          generatedActions: [],
          chatId: existingChatId,
          mode: isAppend ? 'append' : 'create'
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save chat');
      }

      // Track the chat ID for future appends (persist to localStorage)
      if (!existingChatId && data.chatId) {
        saveAgentChatId(data.chatId);
        currentChatId = data.chatId;
      }

      // Update last saved index to current length
      saveLastSavedIndex(chatHistory.length);

      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      showToast('Saved!');

    } catch (error) {
      log('error', 'Error saving chat:', error);
      showToast('Failed to save. Please try again.', { type: 'error' });
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  });

  // Reset conversation button
  document.getElementById('reset-conversation-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the conversation? This will clear the chat history.')) {
      clearChatHistory();
    }
  });

  // Chat form
  chatForm?.addEventListener('submit', handleChatSubmit);

  // Enter key handler - auto-submit on desktop only, newline on mobile
  messageInput?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = window.matchMedia('(pointer: coarse)').matches;
      if (!isMobile) {
        e.preventDefault();
        chatForm?.requestSubmit();
      }
    }
  });

  // Auto-resize textarea
  messageInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    updateSendButton();
  });

  // View links
  document.querySelectorAll('.view-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      log('debug', '[view-link click] View clicked:', view);
      window.location.hash = view;
      await switchToView(view);
    });
  });

  // Goal more link
  document.getElementById('goal-more-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    window.location.hash = 'settings';
    await switchToView('settings');
  });

  // Hash change
  window.addEventListener('hashchange', initializeViewFromHash);

  // Action chat context ready (when Chat button clicked while already on agent page)
  window.addEventListener('actionChatContextReady', async () => {
    const actionChatContextStr = sessionStorage.getItem('actionChatContext');
    if (actionChatContextStr) {
      try {
        const actionContext = JSON.parse(actionChatContextStr);
        sessionStorage.removeItem('actionChatContext');
        currentMeasurementActionContext = actionContext;
        await switchToView('chat');
        showActionContextIndicator(actionContext.title);
      } catch (e) {
        log('error', 'Error parsing action chat context:', e);
        sessionStorage.removeItem('actionChatContext');
      }
    }
  });

  // Filter change
  document.getElementById('actions-filter')?.addEventListener('change', renderActions);

  // Reload actions event
  window.addEventListener('reloadActions', async () => {
    await loadActions();
    actionsLoaded = true;
  });

  // Agent loaded event - initialize chat
  window.addEventListener('agentLoaded', async (event) => {
    const agent = event.detail;

    // Load actions early to ensure accurate counts in header
    await ensureActionsLoaded();

    if (chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        if (typeof msg.content !== 'string') return;
        renderMessage(msg.role, msg.content);
      });
    } else {
      const greeting = {
        role: 'assistant',
        content: `Ready to get to work? I can help suggest next steps, and we can work together to create assets or create actions I'll complete at a scheduled time. How would you like to begin?`,
        timestamp: new Date().toISOString()
      };
      chatHistory.push(greeting);
      saveAgentChatHistory(chatHistory);
      renderMessage('assistant', greeting.content);
    }

    if (draftActions.length > 0) {
      draftActions.forEach(action => {
        renderDraftActionCard(action);
      });
    }

    updateAssetsCount();
    await initializeViewFromHash();
  });
}

// -----------------------------
// Global Window Functions
// (Required for onclick handlers in rendered HTML)
// -----------------------------
window.viewActionModal = viewActionModal;
window.copyActionContent = copyActionContent;
window.completeAction = completeAction;
window.deleteAction = deleteAction;
window.openMeasurementChat = openMeasurementChat;

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  log('debug', 'Initializing agent module');

  // Initialize user
  initializeUser();

  // Get agent ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  agentId = urlParams.get('id');

  if (!agentId) {
    document.getElementById('loading-agent').style.display = 'none';
    document.getElementById('agent-error').style.display = 'block';
    return;
  }

  // Initialize DOM references
  chatMessages = document.getElementById('agent-chat-messages-inner');
  chatMessagesContainer = document.getElementById('agent-chat-messages');
  chatForm = document.getElementById('agent-chat-form');
  messageInput = document.getElementById('agent-message-input');
  sendButton = document.getElementById('agent-send-button');

  // Load state from localStorage
  chatHistory = getAgentChatHistory();
  draftActions = getDraftActions();
  currentChatId = getAgentChatId();

  // Setup event listeners
  setupEventListeners();

  // Load agent data
  loadAgentData();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
