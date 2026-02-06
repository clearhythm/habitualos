/**
 * POST /api/relational-chat-save
 * Save a relational chat to Firestore.
 * Uses shared @habitualos/chat-storage package.
 */

const { createChatSaveHandler } = require('@habitualos/chat-storage');

exports.handler = createChatSaveHandler({
  collection: 'relational-chats',
  idPrefix: 'rc'
});
