require('dotenv').config();
const { createChatSaveHandler } = require('@habitualos/chat-storage');

/**
 * POST /api/signal-chat-save
 * Save a Signal conversation to Firestore.
 */
exports.handler = createChatSaveHandler({
  collection: 'signal-chats',
  idPrefix: 'sc'
});
