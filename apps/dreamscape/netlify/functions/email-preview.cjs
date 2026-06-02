const { transactionals } = require('@habitualos/email-service');
const theme = require('./_email/theme.cjs');

const TEMPLATES = {
  'magic-link': () => transactionals.magicLinkAuth.render(theme, {
    verifyUrl: 'https://daily.habitualos.com/signin/?token=preview-token-123',
  }).html,
};

exports.handler = async (event) => {
  if (process.env.NODE_ENV === 'production') {
    return { statusCode: 404, body: 'Not found' };
  }

  const name = event.queryStringParameters?.template || 'magic-link';
  const render = TEMPLATES[name];
  if (!render) {
    return { statusCode: 404, body: `Unknown template: ${name}. Available: ${Object.keys(TEMPLATES).join(', ')}` };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: render(),
  };
};
