require('dotenv').config();
const { resolveChatContext } = require('@habitualos/frontend-utils');
const { checkPendingSurvey } = require('@habitualos/survey-engine');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405 };

  const { userId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const context = await resolveChatContext(userId, [
    checkPendingSurvey('survey-obi-v1'),
    // future checks go here
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context)
  };
};
