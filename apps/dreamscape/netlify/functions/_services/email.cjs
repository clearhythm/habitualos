const { sendMagicLink: _sendMagicLink } = require('@habitualos/email-service');

async function sendMagicLink({ to, verifyUrl }) {
  return _sendMagicLink({
    to,
    verifyUrl,
    appName: 'Daily Practice',
    primaryColor: '#4a3f6b',
  });
}

module.exports = { sendMagicLink };
