// HabitualOS Client-Side JavaScript
// Handles chat interface, form submissions, and UI interactions

// ============================================================================
// Chat Interface
// ============================================================================

/**
 * Send a chat message to the API and display the response
 * @param {string} actionId - The action ID
 * @param {string} message - The user's message
 */
async function sendMessage(actionId, message) {
  try {
    const response = await fetch(`/api/action/${actionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (data.success) {
      appendMessage('user', message);
      appendMessage('assistant', data.response);
    } else {
      console.error('Failed to send message:', data.error);
      alert('Failed to send message. Please try again.');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Network error. Please check your connection.');
  }
}

/**
 * Append a message to the chat UI
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - The message content
 */
function appendMessage(role, content) {
  const messagesContainer = document.querySelector('.chat-messages');
  if (!messagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message-${role}`;
  messageDiv.textContent = content;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================================================
// Form Handlers
// ============================================================================

/**
 * Handle chat form submission
 */
function initChatForm() {
  const chatForm = document.querySelector('#chat-form');
  if (!chatForm) return;

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = e.target.querySelector('input[name="message"]');
    const message = input.value.trim();

    if (!message) return;

    const actionId = e.target.dataset.actionId;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    await sendMessage(actionId, message);

    // Reset form
    input.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
  });
}

/**
 * Handle setup form submission
 */
function initSetupForm() {
  const setupForm = document.querySelector('#setup-form');
  if (!setupForm) return;

  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const successCriteria = formData.get('success_criteria')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const data = {
      title: formData.get('title'),
      goal: formData.get('goal'),
      success_criteria: successCriteria,
      timeline: formData.get('timeline')
    };

    const submitBtn = document.querySelector('#submit-btn');
    const loadingState = document.querySelector('#loading-state');

    // Show loading state
    submitBtn.disabled = true;
    loadingState.style.display = 'block';

    try {
      const response = await fetch('/api/northstar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to dashboard
        window.location.href = '/';
      } else {
        alert('Failed to create NorthStar. Please try again.');
        submitBtn.disabled = false;
        loadingState.style.display = 'none';
      }
    } catch (error) {
      console.error('Error creating NorthStar:', error);
      alert('Network error. Please try again.');
      submitBtn.disabled = false;
      loadingState.style.display = 'none';
    }
  });
}

/**
 * Handle action controls (complete/dismiss)
 */
function initActionControls() {
  // Mark Complete button
  const completeBtn = document.querySelector('#mark-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      if (!confirm('Mark this action as complete?')) return;

      const actionId = getActionIdFromUrl();

      try {
        const response = await fetch(`/api/action/${actionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/';
        } else {
          alert('Failed to mark action as complete.');
        }
      } catch (error) {
        console.error('Error completing action:', error);
        alert('Network error. Please try again.');
      }
    });
  }

  // Dismiss button
  const dismissBtn = document.querySelector('#dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', async () => {
      const reason = prompt('Why are you dismissing this action?');
      if (!reason) return;

      const actionId = getActionIdFromUrl();

      try {
        const response = await fetch(`/api/action/${actionId}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/';
        } else {
          alert('Failed to dismiss action.');
        }
      } catch (error) {
        console.error('Error dismissing action:', error);
        alert('Network error. Please try again.');
      }
    });
  }

  // Generate Artifact button
  const generateBtn = document.querySelector('#generate-artifact-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const title = prompt('Artifact title:');
      if (!title) return;

      const type = prompt('Artifact type (markdown, code, image, data):');
      if (!type) return;

      const actionId = getActionIdFromUrl();

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';

      try {
        const response = await fetch(`/api/action/${actionId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, title })
        });

        const data = await response.json();

        if (data.success) {
          alert('Artifact generated successfully!');
          location.reload();
        } else {
          alert('Failed to generate artifact.');
        }
      } catch (error) {
        console.error('Error generating artifact:', error);
        alert('Network error. Please try again.');
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '+ Generate New Artifact';
      }
    });
  }
}

/**
 * Toggle completed actions visibility
 */
function initToggleCompleted() {
  const toggleBtn = document.querySelector('#toggle-completed');
  const completedSection = document.querySelector('#completed-actions');

  if (toggleBtn && completedSection) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = completedSection.style.display === 'none';

      if (isHidden) {
        completedSection.style.display = 'grid';
        toggleBtn.textContent = 'Hide Completed (2)';
      } else {
        completedSection.style.display = 'none';
        toggleBtn.textContent = 'Show Completed (2)';
      }
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get action ID from current URL
 * @returns {string} The action ID
 */
function getActionIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  return pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initChatForm();
  initSetupForm();
  initActionControls();
  initToggleCompleted();
});
