//
// netlify/functions/_utils/data-utils.cjs
// ------------------------------------------------------
// ID generation utilities for backend
// Mirrors frontend data-utils.js but with longer IDs for security
// ------------------------------------------------------

// Internal helper: generates a unique ID with optional prefix
// Uses longer format than frontend (full timestamp + 4 random chars)
function uniqueId(prefix = "") {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`;
}

// Generates a unique Agent ID with "agent-" prefix
function generateAgentId() {
  return uniqueId('agent');
}

// Generates a unique Action ID with "action-" prefix
function generateActionId() {
  return uniqueId('action');
}

// Generates a unique Action Chat ID with "ac-" prefix
function generateActionChatId() {
  return uniqueId('ac');
}

// Generates a unique Action Artifact ID with "aa-" prefix
function generateActionArtifactId() {
  return uniqueId('aa');
}

// Generates a unique User ID with "u-" prefix
function generateUserId() {
  return uniqueId('u');
}

// Generates a unique Practice ID with "p-" prefix
function generatePracticeId() {
  return uniqueId('p');
}

// Generates a unique Agent Creation Chat ID with "acc-" prefix
function generateAgentCreationChatId() {
  return uniqueId('acc');
}

// Generates a unique Measurement ID with "m-" prefix
function generateMeasurementId() {
  return uniqueId('m');
}

// Export named functions (alphabetically)
module.exports = {
  generateActionArtifactId,
  generateActionChatId,
  generateActionId,
  generateAgentCreationChatId,
  generateAgentId,
  generateMeasurementId,
  generatePracticeId,
  generateUserId,
  // Also export uniqueId for any custom prefixes
  uniqueId
};
