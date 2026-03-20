const { resolveChatContext } = require('./src/chat-context.cjs');
const { resolveOpeningMessage, PACKAGE_DEFAULT_MESSAGES } = require('./src/opening-message.cjs');

module.exports = { resolveChatContext, resolveOpeningMessage, PACKAGE_DEFAULT_MESSAGES };
