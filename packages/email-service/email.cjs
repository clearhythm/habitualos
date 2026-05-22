const { Resend } = require('resend');
const magicLinkTemplate = require('./templates/magic-link.cjs');

let resendClient = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendMagicLink({ to, verifyUrl, appName = 'HabitualOS', primaryColor = '#3a7a10', buttonColor, fromEmail }) {
  const client = getClient();
  const from = fromEmail || process.env.RESEND_FROM_EMAIL || `${appName} <noreply@habitualos.com>`;
  const { subject, text, html } = magicLinkTemplate.render({ appName, verifyUrl, primaryColor, buttonColor });

  const { data, error } = await client.emails.send({ from, to, subject, text, html });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

module.exports = { sendMagicLink };
