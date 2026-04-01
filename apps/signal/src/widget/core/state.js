// core/state.js — single mutable state object shared across all modules

export const state = {
  signalId: null,       // from data-signal-id attr
  baseUrl: null,        // from script.src origin
  activeMode: null,     // 'visitor' | 'owner' | 'onboard'
  isStreaming: false,
  chatHistory: [],
  chatId: null,
  currentPersona: null,
  turnCount: 0,
  lastScore: null,
  ownerConfig: null,
  ownerSession: null,   // { userId, signalId, displayName } from storage
  currentEvalId: null,
  scoreCollapsed: false,
  authState: null,      // null | 'awaiting_email' | 'awaiting_code'
  authEmail: null,
  leadSubmitted: false,
  evalContext: null,
};

// Resets session state without losing config/identity
export function resetChatState() {
  state.activeMode = null;
  state.isStreaming = false;
  state.chatHistory = [];
  state.chatId = null;
  state.currentPersona = null;
  state.turnCount = 0;
  state.lastScore = null;
  state.currentEvalId = null;
  state.scoreCollapsed = false;
  state.authState = null;
  state.authEmail = null;
  state.leadSubmitted = false;
  state.evalContext = null;
  // Preserved: signalId, baseUrl, ownerConfig, ownerSession
}
