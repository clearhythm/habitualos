const { createMagicLinkConsumeHandler } = require('@habitualos/auth-server');

const baseHandler = createMagicLinkConsumeHandler();

exports.handler = async (event) => {
  const result = await baseHandler(event);
  if (result.statusCode !== 200) return result;

  const connId = event.queryStringParameters?.connId || null;
  if (!connId) return result;

  const body = JSON.parse(result.body);
  return { ...result, body: JSON.stringify({ ...body, connId }) };
};
