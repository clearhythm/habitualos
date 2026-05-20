const { sendMagicLink: sendMagicLinkEmail } = require('@habitualos/email-service');

async function sendMagicLink({ to, verifyUrl }) {
  return sendMagicLinkEmail({
    to,
    verifyUrl,
    appName: 'Daily Practice',
    primaryColor: '#4a3f6b',
  });
}

module.exports = { sendMagicLink };
