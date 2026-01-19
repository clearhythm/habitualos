/**
 * Practice Chat State Management
 * Manages localStorage for chat history and suggested practice
 */

const CHAT_HISTORY_KEY = 'practice-chat-history';
const CHAT_STATE_KEY = 'practice-chat-state';
const CHAT_ID_KEY = 'practice-chat-id';
const LAST_SAVED_INDEX_KEY = 'practice-chat-last-saved-index';
const EXPIRY_HOURS = 24;

/**
 * Check if a timestamp is expired (older than 24 hours)
 */
function isExpired(timestamp) {
  if (!timestamp) return true;
  const now = new Date();
  const then = new Date(timestamp);
  const hoursDiff = (now - then) / (1000 * 60 * 60);
  return hoursDiff > EXPIRY_HOURS;
}

/**
 * Validate chat message structure
 */
function isValidMessage(msg) {
  return msg &&
         typeof msg === 'object' &&
         typeof msg.role === 'string' &&
         typeof msg.content === 'string' &&
         typeof msg.timestamp === 'string';
}

/**
 * Validate chat state structure
 */
function isValidChatState(state) {
  return state &&
         typeof state === 'object' &&
         typeof state.suggestedPractice === 'string' &&
         typeof state.timestamp === 'string';
}

// ============================================
// Chat History Management
// ============================================

/**
 * Save chat history to localStorage
 * @param {Array} messages - Array of message objects with role, content, timestamp
 */
export function saveChatHistory(messages) {
  try {
    if (!Array.isArray(messages)) {
      console.error('saveChatHistory: messages must be an array');
      return;
    }

    const data = {
      messages,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

/**
 * Get chat history from localStorage
 * @returns {Array} Array of messages, or empty array if expired/missing
 */
export function getChatHistory() {
  try {
    const item = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!item) return [];

    const data = JSON.parse(item);

    // Check expiry
    if (isExpired(data.timestamp)) {
      clearChatHistory();
      return [];
    }

    // Validate structure
    if (!Array.isArray(data.messages)) {
      console.error('Invalid chat history structure');
      clearChatHistory();
      return [];
    }

    // Validate each message
    const validMessages = data.messages.filter(isValidMessage);
    if (validMessages.length !== data.messages.length) {
      console.warn('Some messages had invalid structure and were filtered out');
    }

    return validMessages;
  } catch (error) {
    console.error('Error getting chat history:', error);
    clearChatHistory();
    return [];
  }
}

/**
 * Clear chat history from localStorage
 */
export function clearChatHistory() {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    // Also clear chatId and lastSavedIndex when clearing history
    localStorage.removeItem(CHAT_ID_KEY);
    localStorage.removeItem(LAST_SAVED_INDEX_KEY);
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
}

// ============================================
// Chat ID Management (for append mode)
// ============================================

/**
 * Save chat ID to localStorage
 * @param {string} chatId - The chat ID returned from the server
 */
export function saveChatId(chatId) {
  try {
    localStorage.setItem(CHAT_ID_KEY, chatId);
  } catch (error) {
    console.error('Error saving chat ID:', error);
  }
}

/**
 * Get chat ID from localStorage
 * @returns {string|null} Chat ID or null if not found
 */
export function getChatId() {
  try {
    return localStorage.getItem(CHAT_ID_KEY);
  } catch (error) {
    console.error('Error getting chat ID:', error);
    return null;
  }
}

/**
 * Clear chat ID from localStorage
 */
export function clearChatId() {
  try {
    localStorage.removeItem(CHAT_ID_KEY);
  } catch (error) {
    console.error('Error clearing chat ID:', error);
  }
}

// ============================================
// Last Saved Index Management (for append mode)
// ============================================

/**
 * Save last saved index to localStorage
 * @param {number} index - The index up to which messages have been saved
 */
export function saveLastSavedIndex(index) {
  try {
    localStorage.setItem(LAST_SAVED_INDEX_KEY, String(index));
  } catch (error) {
    console.error('Error saving last saved index:', error);
  }
}

/**
 * Get last saved index from localStorage
 * @returns {number} Last saved index (0 if not found)
 */
export function getLastSavedIndex() {
  try {
    const value = localStorage.getItem(LAST_SAVED_INDEX_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('Error getting last saved index:', error);
    return 0;
  }
}

// ============================================
// Suggested Practice State Management
// ============================================

/**
 * Save practice chat state to localStorage
 * @param {Object} state - State object with suggestedPractice, fullSuggestion, timestamp
 */
export function savePracticeChatState(state) {
  try {
    if (!state || typeof state !== 'object') {
      console.error('savePracticeChatState: state must be an object');
      return;
    }

    const data = {
      suggestedPractice: state.suggestedPractice || '',
      fullSuggestion: state.fullSuggestion || '',
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving practice chat state:', error);
  }
}

/**
 * Get practice chat state from localStorage
 * @returns {Object|null} State object or null if expired/missing
 */
export function getPracticeChatState() {
  try {
    const item = localStorage.getItem(CHAT_STATE_KEY);
    if (!item) return null;

    const data = JSON.parse(item);

    // Check expiry
    if (isExpired(data.timestamp)) {
      clearPracticeChatState();
      return null;
    }

    // Validate structure
    if (!isValidChatState(data)) {
      console.error('Invalid practice chat state structure');
      clearPracticeChatState();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting practice chat state:', error);
    clearPracticeChatState();
    return null;
  }
}

/**
 * Clear practice chat state from localStorage
 */
export function clearPracticeChatState() {
  try {
    localStorage.removeItem(CHAT_STATE_KEY);
  } catch (error) {
    console.error('Error clearing practice chat state:', error);
  }
}
