require('dotenv').config();
const { createMagicLinkSendHandler } = require('@habitualos/auth-server');
const { sendMagicLink } = require('./_email/email.cjs');

exports.handler = createMagicLinkSendHandler({
  getBaseUrl: () => process.env.BASE_URL || 'https://practice.habitualos.com',
  sendEmail: sendMagicLink
});
