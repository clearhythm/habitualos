const { createMagicLinkConsumeHandler } = require('@habitualos/auth-server');

const baseHandler = createMagicLinkConsumeHandler();

exports.handler = async (event) => {
  const result = await baseHandler(event);
  if (result.statusCode !== 200) return result;

  const inviteId = event.queryStringParameters?.inviteId || null;
  if (!inviteId) return result;

  const body = JSON.parse(result.body);
  return { ...result, body: JSON.stringify({ ...body, inviteId }) };
};
