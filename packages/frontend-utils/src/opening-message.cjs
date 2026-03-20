const PACKAGE_DEFAULT_MESSAGES = {
  survey: "There's a check-in ready for you. Want to do that first, or dive right in?",
  default: "How can I help you today?"
};

function resolveOpeningMessage(priority, appMessages = {}) {
  const key = priority || 'default';
  return appMessages[key] || PACKAGE_DEFAULT_MESSAGES[key] || PACKAGE_DEFAULT_MESSAGES.default;
}

module.exports = { resolveOpeningMessage, PACKAGE_DEFAULT_MESSAGES };
