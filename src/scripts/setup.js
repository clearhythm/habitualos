//
// scripts/setup.js
// ------------------------------------------------------
// Setup page module - handles agent creation wizard chat
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { log } from '/assets/js/utils/log.js';

// -----------------------------
// State
// -----------------------------
let chatHistory = [];
let currentAgentData = null;
let loadingMessageElement = null;

// -----------------------------
// DOM Elements (populated on init)
// -----------------------------
let chatMessages = null;
let chatMessagesContainer = null;
let chatForm = null;
let messageInput = null;
let sendButton = null;
let readyButtonContainer = null;
let readyButton = null;
let dismissReadyButton = null;
let chatContainer = null;
let creatingAgentOverlay = null;

// -----------------------------
// UI Functions
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
  loadingDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5; background-color: #eff6ff; color: #333; align-self: flex-start; border-left: 3px solid #ddd; border-bottom-left-radius: 4px;';
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

function renderMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5;';

  if (role === 'assistant') {
    messageDiv.style.cssText += 'background-color: #eff6ff; color: #333; align-self: flex-start; border-left: 3px solid #2563eb; border-bottom-left-radius: 4px;';

    if (window.marked) {
      messageDiv.innerHTML = marked.parse(content);
    } else {
      messageDiv.textContent = content;
    }
  } else {
    messageDiv.style.cssText += 'background-color: #2563eb; color: white; align-self: flex-end; border-bottom-right-radius: 4px;';
    messageDiv.textContent = content;
  }

  chatMessages.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// -----------------------------
// Chat Form Handler
// -----------------------------
async function handleChatSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  const userId = getUserId();

  // Add user message to UI and history
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  renderMessage('user', message);
  chatHistory.push(userMessage);

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Disable send button
  sendButton.disabled = true;
  sendButton.style.background = '#ddd';
  sendButton.style.cursor = 'not-allowed';

  // Show loading message inline
  showLoadingMessage();

  try {
    const response = await fetch('/.netlify/functions/setup-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        message,
        chatHistory: chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get response');
    }

    hideLoadingMessage();

    // Add assistant response to UI and history
    const assistantMessage = {
      role: 'assistant',
      content: data.response,
      timestamp: new Date().toISOString()
    };
    renderMessage('assistant', data.response);
    chatHistory.push(assistantMessage);

    // Check if ready to create agent
    if (data.ready) {
      currentAgentData = data.agentData;

      // Show "Create Agent" modal
      readyButtonContainer.style.display = 'flex';

      // Disable chat form
      sendButton.disabled = true;
      sendButton.style.background = '#ddd';
      sendButton.style.cursor = 'not-allowed';
      messageInput.disabled = true;
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
  }
}

// -----------------------------
// Agent Creation
// -----------------------------
async function handleCreateAgent() {
  if (!currentAgentData) return;

  const userId = getUserId();

  // Show creating agent overlay
  chatContainer.style.display = 'none';
  creatingAgentOverlay.style.display = 'flex';

  // Animate dots while creating
  const creatingMessage = document.getElementById('creating-message');
  const baseMessage = 'Setting up your agent';
  let dotCount = 0;
  const dotInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    creatingMessage.textContent = baseMessage + '.'.repeat(dotCount);
  }, 400);

  try {
    const response = await fetch('/.netlify/functions/agent-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ...currentAgentData,
        chatHistory: chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create agent');
    }

    clearInterval(dotInterval);

    // Update overlay to show success
    document.getElementById('creating-emoji').textContent = '✨';
    document.getElementById('creating-title').textContent = 'Agent Created!';
    document.getElementById('creating-message').textContent = 'Redirecting to your new agent...';

    setTimeout(() => {
      window.location.href = `/do/agent/?id=${data.agent.id}`;
    }, 1000);

  } catch (error) {
    log('error', 'Error creating agent:', error);
    clearInterval(dotInterval);

    alert('Failed to create agent. Please try again.');

    // Go back to chat
    creatingAgentOverlay.style.display = 'none';
    chatContainer.style.display = 'flex';
    messageInput.disabled = false;
    messageInput.focus();
    updateSendButton();
  }
}

// -----------------------------
// Event Listeners Setup
// -----------------------------
function setupEventListeners() {
  // Chat form
  chatForm.addEventListener('submit', handleChatSubmit);

  // Create Agent button
  readyButton.addEventListener('click', handleCreateAgent);

  // Dismiss "Create Agent" button
  dismissReadyButton.addEventListener('click', () => {
    readyButtonContainer.style.display = 'none';
    messageInput.disabled = false;
    messageInput.focus();
    updateSendButton();
  });

  // Enter key handler - auto-submit on desktop only, newline on mobile
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = window.matchMedia('(pointer: coarse)').matches;
      if (!isMobile) {
        e.preventDefault();
        chatForm.requestSubmit();
      }
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    updateSendButton();
  });

  // Reset chat button
  document.getElementById('reset-chat-btn').addEventListener('click', () => {
    if (confirm('Start over? This will clear your current conversation.')) {
      window.location.reload();
    }
  });
}

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  log('debug', 'Initializing setup module');

  // Initialize user
  initializeUser();

  // Initialize DOM references
  chatMessages = document.getElementById('chat-messages-inner');
  chatMessagesContainer = document.getElementById('chat-messages');
  chatForm = document.getElementById('chat-form');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  readyButtonContainer = document.getElementById('ready-button-container');
  readyButton = document.getElementById('ready-button');
  dismissReadyButton = document.getElementById('dismiss-ready-button');
  chatContainer = document.getElementById('chat-container');
  creatingAgentOverlay = document.getElementById('creating-agent-overlay');

  // Setup event listeners
  setupEventListeners();

  // Add header to chat messages area
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'text-align: center; padding: 2rem 1rem 1rem 1rem; margin-bottom: 1rem;';
  headerDiv.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: .5rem;">🤖</div>
    <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; color: #333; font-weight: 600;">Create Your Agent</h1>
    <p style="margin: 0; font-size: 0.95rem; color: #999;">Let's define what you want to accomplish.</p>
  `;
  chatMessages.appendChild(headerDiv);

  // Initialize chat with opening message
  const openingMessage = {
    role: 'assistant',
    content: "Hi! I'm here to help you create an agent. What would you like your agent to help you accomplish?",
    timestamp: new Date().toISOString()
  };
  chatHistory.push(openingMessage);
  renderMessage('assistant', openingMessage.content);

  // Focus message input
  messageInput.focus();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
