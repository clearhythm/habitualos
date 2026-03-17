require('dotenv').config();
const { createChatSaveHandler } = require('@habitualos/chat-storage');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const baseHandler = createChatSaveHandler({ collection: 'signal-chats', idPrefix: 'sc' });

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  const result = await baseHandler(event, context);
  result.headers = { ...CORS, ...(result.headers || {}) };
  return result;
};
