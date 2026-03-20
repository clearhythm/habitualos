require('dotenv').config();
const { resolveChatContext } = require('@habitualos/frontend-utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405 };

  const { userId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const context = await resolveChatContext(userId, [
    // future checks go here e.g. checkPendingOnboarding()
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context)
  };
};
