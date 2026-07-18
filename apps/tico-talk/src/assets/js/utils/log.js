import { APP_ENV } from './env-config.js';

const LOG_LEVEL = ['local', 'dev'].includes(APP_ENV) ? 'debug' : 'warn';
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

export function log(levelOrMessage, ...args) {
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
