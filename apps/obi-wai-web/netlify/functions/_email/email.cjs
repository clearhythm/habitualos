const { sendEmail, transactionals } = require('@habitualos/email-service');
const theme = require('./theme.cjs');

async function sendMagicLink({ to, verifyUrl }) {
  const { subject, text, html } = transactionals.magicLinkAuth.render(theme, { verifyUrl });
  return sendEmail({ from: theme.fromEmail, to, subject, text, html });
}

module.exports = { sendMagicLink };
