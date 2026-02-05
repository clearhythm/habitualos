//
// log.js
// ------------------------------------------------------
// Handles logging across the app
// ------------------------------------------------------
//
import { APP_ENV } from "./env-config.js";

// Set log level based on environment
const LOG_LEVEL = ["local", "preview"].includes(APP_ENV) ? "debug" : "warn";

// Allowed log levels (internal only)
const LOG_LEVELS = ["debug", "info", "warn", "error"];

// Exported logger
export function log(levelOrMessage, ...args) {
  let level = "info"; // Default log level
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
