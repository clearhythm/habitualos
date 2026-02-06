/**
 * @habitualos/chat-storage
 * Shared chat storage utilities for HabitualOS apps.
 */

const { createChatService } = require('./db-chats.cjs');
const { createChatSaveHandler } = require('./chat-save-handler.cjs');
const { createChatListHandler } = require('./chat-list-handler.cjs');

module.exports = {
  createChatService,
  createChatSaveHandler,
  createChatListHandler
};
