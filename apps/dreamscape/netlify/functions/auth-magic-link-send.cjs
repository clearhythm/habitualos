const { createMagicLinkSendHandler } = require('@habitualos/auth-server');
const { sendMagicLink } = require('./_services/email.cjs');

exports.handler = createMagicLinkSendHandler({
  getBaseUrl: () => process.env.BASE_URL || 'https://daily.habitualos.com',
  sendEmail: sendMagicLink,
});
