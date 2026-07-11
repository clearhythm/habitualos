const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

function log(levelOrMessage, ...args) {
  let level = 'info';
  let messageArgs = [];

  if (LOG_LEVELS.includes(levelOrMessage)) {
    level = levelOrMessage;
    messageArgs = args;
  } else {
    messageArgs = [levelOrMessage, ...args];
  }

  if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(LOG_LEVEL)) {
    console[level](...messageArgs);
  }
}

module.exports = { log };
