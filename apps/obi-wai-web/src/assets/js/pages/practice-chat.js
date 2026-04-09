import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { saveChatHistory, getChatHistory, clearChatHistory, savePracticeChatState, getPracticeChatState, clearPracticeChatState, saveChatId, getChatId, saveLastSavedIndex, getLastSavedIndex } from '/assets/js/practice-chat-state.js';
import { initializeUser, getUserId } from '/assets/js/auth/auth.js';
import { showToast } from '/assets/js/components/chat-toast.js';

requireSignIn();

initializeUser();
const userId = getUserId();

const chatMessages = document.getElementById('chat-messages-inner');
const chatMessagesContainer = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const readyButtonContainer = document.getElementById('ready-button-container');
const readyButton = document.getElementById('ready-button');
const dismissReadyButton = document.getElementById('dismiss-ready-button');
const chatContainer = document.getElementById('chat-container');
const doPracticeOverlay = document.getElementById('do-practice-overlay');
const iPracticedButton = document.getElementById('i-practiced-button');

let currentPracticeData = null;
let loadingMessageElement = null;

let streamingMessageElement = null;
let streamingText = '';
let streamingStarted = false;
let streamingToolEvents = [];

function updateSendButton() {
  const hasContent = messageInput.value.trim().length > 0;
  sendButton.disabled = !hasContent;

  if (hasContent) {
    sendButton.style.background = '#9b59b6';
    sendButton.style.cursor = 'pointer';
  } else {
    sendButton.style.background = '#ddd';
    sendButton.style.cursor = 'not-allowed';
  }
}

function showLoadingMessage() {
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5; background-color: #f9f6ff; color: #333; align-self: flex-start; border-left: 3px solid #ddd; border-bottom-left-radius: 4px;';
  loadingDiv.innerHTML = '<span style="color: #999; font-style: italic;">Obi-Wai is thinking...</span>';
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

function buildStreamingToolHtml() {
  return streamingToolEvents.map(e =>
    `<div style="font-size: 0.75rem; color: #6b7280; font-style: italic; margin-bottom: 0.5rem;">${e}</div>`
  ).join('');
}

function updateStreamingToolStatus(toolName, status) {
  if (!streamingMessageElement) return;
  const label = toolLabels[toolName] || toolName;
  if (status === 'start') {
    streamingToolEvents.push(`Using ${label}...`);
  } else {
    const idx = streamingToolEvents.findIndex(e => e === `Using ${label}...`);
    if (idx !== -1) {
      streamingToolEvents[idx] = `✓ Looked up your ${label}`;
    } else {
      streamingToolEvents.push(`✓ Looked up your ${label}`);
    }
  }
  const toolHtml = buildStreamingToolHtml();
  const cursor = '<span class="streaming-cursor" style="display: inline-block; width: 2px; height: 1em; background: #9b59b6; animation: blink 1s infinite;"></span>';
  const contentHtml = window.marked && streamingText ? marked.parse(streamingText) : (streamingText ? streamingText : '<span style="color: #999; font-style: italic;">Obi-Wai is thinking...</span>');
  streamingMessageElement.innerHTML = toolHtml + contentHtml + cursor;
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function showStreamingMessage() {
  streamingText = '';
  streamingStarted = false;
  streamingToolEvents = [];
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5; background-color: #f9f6ff; color: #333; align-self: flex-start; border-left: 3px solid #ddd; border-bottom-left-radius: 4px;';
  messageDiv.innerHTML = '<span style="color: #999; font-style: italic;">Obi-Wai is thinking...</span>';
  chatMessages.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  streamingMessageElement = messageDiv;

  if (!document.getElementById('streaming-cursor-style')) {
    const style = document.createElement('style');
    style.id = 'streaming-cursor-style';
    style.textContent = '@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }';
    document.head.appendChild(style);
  }
}

function appendStreamingText(text) {
  if (!streamingMessageElement) return;
  streamingText += text;

  if (!streamingStarted) {
    streamingStarted = true;
    streamingMessageElement.style.borderLeftColor = '#9b59b6';
  }

  const toolHtml = buildStreamingToolHtml();
  const cursor = '<span class="streaming-cursor" style="display: inline-block; width: 2px; height: 1em; background: #9b59b6; animation: blink 1s infinite;"></span>';
  if (window.marked) {
    streamingMessageElement.innerHTML = toolHtml + marked.parse(streamingText) + cursor;
  } else {
    streamingMessageElement.textContent = streamingText;
  }
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function finalizeStreamingMessage() {
  if (!streamingMessageElement) return { text: '', displayText: '' };

  const toolHtml = buildStreamingToolHtml();
  if (window.marked && streamingText) {
    streamingMessageElement.innerHTML = toolHtml + marked.parse(streamingText);
  } else if (streamingText) {
    streamingMessageElement.textContent = streamingText;
  }

  const finalText = streamingText;
  streamingMessageElement = null;
  streamingText = '';
  streamingStarted = false;
  streamingToolEvents = [];

  return { text: finalText, displayText: finalText };
}

function hideStreamingMessage() {
  if (streamingMessageElement) {
    streamingMessageElement.remove();
    streamingMessageElement = null;
    streamingText = '';
    streamingStarted = false;
    streamingToolEvents = [];
  }
}

function showReadyModal(practiceName, message) {
  currentPracticeData = {
    practiceName,
    fullSuggestion: message
  };
  readyButtonContainer.style.display = 'flex';
  sendButton.disabled = true;
  sendButton.style.background = '#ddd';
  sendButton.style.cursor = 'not-allowed';
  messageInput.disabled = true;
}

function showSurveyResultsSummary(summary) {
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = 'margin-top: 0.5rem; padding: 0.75rem 1rem; background: #f0f9f0; border-left: 3px solid #3a7a10; border-radius: 4px; font-size: 0.9rem; color: #333;';
  const scoresHtml = (Array.isArray(summary) ? summary : []).map(s =>
    `<span style="margin-right: 1rem;"><strong>${s.dimension}:</strong> ${s.score}/10</span>`
  ).join('');
  summaryDiv.innerHTML = `<div style="color: #3a7a10; font-weight: 600; margin-bottom: 0.25rem;">Check-in saved</div><div>${scoresHtml || 'Results recorded.'}</div>`;
  chatMessages.appendChild(summaryDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

let chatHistory = getChatHistory();

function renderMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5;';

  if (role === 'assistant') {
    messageDiv.style.cssText += 'background-color: #f9f6ff; color: #333; align-self: flex-start; border-left: 3px solid #9b59b6; border-bottom-left-radius: 4px;';
    if (window.marked) {
      messageDiv.innerHTML = marked.parse(content);
    } else {
      messageDiv.textContent = content;
    }
  } else {
    messageDiv.style.cssText += 'background-color: #0066cc; color: white; align-self: flex-end; border-bottom-right-radius: 4px;';
    messageDiv.textContent = content;
  }

  chatMessages.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

const APP_MESSAGES = {
  survey: "Before we get going — there's a quick check-in waiting. Want to do that first, or just get to it?",
  default: "What would you like to practice today?"
};

if (chatHistory.length === 0) {
  let openingContent = APP_MESSAGES.default;
  try {
    const ctx = await fetch(`/.netlify/functions/chat-context?userId=${encodeURIComponent(userId)}`).then(r => r.json());
    if (ctx.priority && APP_MESSAGES[ctx.priority]) {
      openingContent = APP_MESSAGES[ctx.priority];
    } else if (ctx.priority) {
      const PACKAGE_DEFAULTS = {
        survey: "There's a check-in ready for you. Want to do that first, or dive right in?"
      };
      openingContent = PACKAGE_DEFAULTS[ctx.priority] || APP_MESSAGES.default;
    }
  } catch (e) {
    // Silently fall back to default on error
  }

  const openingMessage = {
    role: 'assistant',
    content: openingContent,
    timestamp: new Date().toISOString()
  };
  chatHistory.push(openingMessage);
  saveChatHistory(chatHistory);
}

const headerDiv = document.createElement('div');
headerDiv.style.cssText = 'text-align: center; padding: 2rem 1rem 1rem 1rem; margin-bottom: 1rem;';
headerDiv.innerHTML = `
  <div style="font-size: 3rem; margin-bottom: .5rem;">🐉</div>
  <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; color: #333; font-weight: 600;">Motivate</h1>
  <p style="margin: 0; font-size: 0.95rem; color: #999;">Obi-Wai can help light up your path.</p>
`;
chatMessages.appendChild(headerDiv);

chatHistory.forEach(msg => {
  renderMessage(msg.role, msg.content);
});

async function handleStreamingChat(message) {
  showStreamingMessage();

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const response = await fetch('/api/chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatType: 'obi-wai',
      userId,
      message,
      timezone: userTimezone,
      chatHistory: chatHistory.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'token') {
            appendStreamingText(data.text);
          } else if (data.type === 'tool_start') {
            updateStreamingToolStatus(data.tool, 'start');
          } else if (data.type === 'tool_complete') {
            updateStreamingToolStatus(data.tool, 'complete');
            if (data.tool === 'store_survey_results' && data.result?.success && data.result?.summary) {
              showSurveyResultsSummary(data.result.summary);
            }
            if (data.tool === 'show_practice_modal') {
              const { practiceName, message } = data.result;
              showReadyModal(practiceName, message);
            }
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        } catch (parseErr) {
          console.warn('Failed to parse SSE data:', parseErr);
        }
      }
    }
  }

  const { text: fullResponse } = finalizeStreamingMessage();

  const assistantMessage = {
    role: 'assistant',
    content: fullResponse,
    timestamp: new Date().toISOString()
  };
  chatHistory.push(assistantMessage);
  saveChatHistory(chatHistory);
}

const toolLabels = {
  get_practice_history: 'practice history',
  get_practice_detail: 'practice details',
  start_survey: 'check-in',
  submit_survey_answer: 'check-in',
  store_survey_results: 'check-in results',
  abandon_survey: 'check-in'
};

function renderToolIndicators(toolsUsed) {
  if (!toolsUsed || toolsUsed.length === 0) return '';
  return toolsUsed.map(tool => {
    const label = toolLabels[tool] || tool;
    return `<div style="font-size: 0.75rem; color: #6b7280; font-style: italic; margin-bottom: 0.5rem;">✓ Looked up your ${label}</div>`;
  }).join('');
}

async function handleNonStreamingChat(message) {
  showLoadingMessage();

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const response = await fetch('/.netlify/functions/practice-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      message,
      timezone: userTimezone,
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

  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 0.875rem 1rem 1rem 1rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.5; background-color: #f9f6ff; color: #333; align-self: flex-start; border-left: 3px solid #9b59b6; border-bottom-left-radius: 4px;';
  const toolHtml = renderToolIndicators(data.toolsUsed);
  const contentHtml = window.marked ? marked.parse(data.response) : data.response;
  messageDiv.innerHTML = toolHtml + contentHtml;
  chatMessages.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

  const assistantMessage = {
    role: 'assistant',
    content: data.response,
    timestamp: new Date().toISOString()
  };
  chatHistory.push(assistantMessage);
  saveChatHistory(chatHistory);

  if (data.ready) {
    currentPracticeData = {
      practiceName: data.practiceName,
      fullSuggestion: data.response
    };

    readyButtonContainer.style.display = 'flex';

    sendButton.disabled = true;
    sendButton.style.background = '#ddd';
    sendButton.style.cursor = 'not-allowed';
    messageInput.disabled = true;
  }
}

chatForm.addEventListener('submit', async (e) => {
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
  saveChatHistory(chatHistory);

  messageInput.value = '';
  messageInput.style.height = 'auto';

  sendButton.disabled = true;
  sendButton.style.background = '#ddd';
  sendButton.style.cursor = 'not-allowed';

  try {
    await handleStreamingChat(message);
  } catch (streamError) {
    console.warn('Streaming failed, falling back to regular endpoint:', streamError);
    hideStreamingMessage();
    try {
      await handleNonStreamingChat(message);
    } catch (error) {
      console.error('Error sending message:', error);
      hideLoadingMessage();

      const errorMessage = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Could you try again?",
        timestamp: new Date().toISOString()
      };
      renderMessage('assistant', errorMessage.content);
      chatHistory.push(errorMessage);
      saveChatHistory(chatHistory);
    }
  }
});

readyButton.addEventListener('click', () => {
  if (!currentPracticeData) return;

  savePracticeChatState({
    suggestedPractice: currentPracticeData.practiceName,
    fullSuggestion: currentPracticeData.fullSuggestion,
    timestamp: new Date().toISOString()
  });

  chatContainer.style.display = 'none';
  doPracticeOverlay.style.display = 'flex';
});

dismissReadyButton.addEventListener('click', () => {
  readyButtonContainer.style.display = 'none';
  messageInput.disabled = false;
  messageInput.focus();
  updateSendButton();
});

iPracticedButton.addEventListener('click', () => {
  window.location.href = '/practice/log';
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  }
});

messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  updateSendButton();
});

document.getElementById('save-chat-btn').addEventListener('click', async () => {
  if (chatHistory.length === 0) {
    showToast('No conversation to save.', { type: 'info' });
    return;
  }

  const saveBtn = document.getElementById('save-chat-btn');
  const originalText = saveBtn.innerHTML;

  const lastSavedIndex = getLastSavedIndex();
  const newMessages = chatHistory.slice(lastSavedIndex);

  if (newMessages.length === 0) {
    showToast('Already saved.', { type: 'info' });
    return;
  }

  const existingChatId = getChatId();
  const isAppend = existingChatId && lastSavedIndex > 0;

  try {
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    const chatState = getPracticeChatState();

    const response = await fetch('/.netlify/functions/practice-chat-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        messages: isAppend ? newMessages : chatHistory,
        suggestedPractice: chatState?.suggestedPractice || null,
        fullSuggestion: chatState?.fullSuggestion || null,
        completed: chatState?.suggestedPractice ? true : false,
        chatId: existingChatId,
        mode: isAppend ? 'append' : 'create'
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save practice chat');
    }

    if (!existingChatId && data.chatId) {
      saveChatId(data.chatId);
    }

    saveLastSavedIndex(chatHistory.length);

    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
    showToast('Saved!');

  } catch (error) {
    console.error('Error saving practice chat:', error);
    showToast('Failed to save. Please try again.', { type: 'error' });

    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
});

document.getElementById('reset-chat-btn').addEventListener('click', () => {
  if (confirm('Start a fresh conversation? This will clear your current chat.')) {
    clearChatHistory();
    window.location.reload();
  }
});

messageInput.focus();
