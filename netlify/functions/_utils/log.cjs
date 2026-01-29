//
// log.cjs
// ------------------------------------------------------
// Handles logging across Netlify functions
//
// Usage:
//   const { log } = require('./_utils/log.cjs');
//   log('info', '[agent-chat] Request started');
//   log('error', '[agent-chat] Failed:', err);
//   log('[agent-chat] Default info level');
// ------------------------------------------------------
//

// Set log level based on environment
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

// Allowed log levels (internal only)
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

// Exported logger
function log(levelOrMessage, ...args) {
  let level = 'info'; // Default log level
  let messageArgs = [];

  // Determine if first arg is a level or just a message
  if (LOG_LEVELS.includes(levelOrMessage)) {
    level = levelOrMessage;
    messageArgs = args;
  } else {
    messageArgs = [levelOrMessage, ...args];
  }

  // Output if level is allowed
  if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(LOG_LEVEL)) {
    console[level](...messageArgs);
  }
}

module.exports = { log };
