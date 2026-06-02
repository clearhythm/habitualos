const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendEmail({ from, to, subject, text, html }) {
  const client = getClient();
  const { data, error } = await client.emails.send({ from, to, subject, text, html });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

module.exports = {
  sendEmail,
  transactionals: {
    magicLinkAuth: require('./transactionals/magic-link-auth.cjs'),
  },
  templates: {
    base: require('./templates/base.cjs'),
  },
};
