require('dotenv').config();
const { resolveChatContext } = require('@habitualos/frontend-utils');
const { checkPendingSurvey } = require('@habitualos/survey-engine');
// future: const { checkReplyMoment } = require('./wherever-that-lives');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405 };

  const { userId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const context = await resolveChatContext(userId, [
    // checkReplyMoment(userId),  // add when check function exists
    checkPendingSurvey('survey-rel-v1'),
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context)
  };
};
