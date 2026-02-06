/**
 * GET /api/relational-chat-list
 * List relational chats for a user.
 * Uses shared @habitualos/chat-storage package.
 */

const { createChatListHandler } = require('@habitualos/chat-storage');

exports.handler = createChatListHandler({
  collection: 'relational-chats',
  idPrefix: 'rc',
  responseKey: 'relationalChats'
});
