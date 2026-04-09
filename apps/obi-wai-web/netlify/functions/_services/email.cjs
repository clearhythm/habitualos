// Email service for obi-wai-web (Daily Practice)
// Thin wrapper around @habitualos/email-service with app-specific branding.
require('dotenv').config();
const { sendMagicLink: _sendMagicLink } = require('@habitualos/email-service');

async function sendMagicLink({ to, verifyUrl }) {
  return _sendMagicLink({
    to,
    verifyUrl,
    appName: 'Daily Practice',
    primaryColor: '#3a7a10'
  });
}

module.exports = { sendMagicLink };
