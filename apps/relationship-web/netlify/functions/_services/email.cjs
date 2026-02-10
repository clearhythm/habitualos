/**
 * Email service using Resend.
 *
 * Sends transactional emails for survey notifications.
 * Requires RESEND_API_KEY and PIDGERTON_URL environment variables.
 */

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

/**
 * Send a weekly survey notification email.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient's first name
 * @param {string[]} options.dimensions - The 5 focus dimensions for this week
 */
async function sendSurveyNotification({ to, name, dimensions }) {
  const client = getClient();
  const chatUrl = process.env.PIDGERTON_URL || 'https://pidgerton.com';

  const dimensionList = dimensions.map(d => `  - ${d}`).join('\n');

  const { data, error } = await client.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Pidgerton <noreply@pidgerton.com>',
    to,
    subject: 'Your weekly relationship check-in is ready',
    text: `Hey ${name},

Your weekly relationship check-in is ready. This week's focus areas:

${dimensionList}

When you're ready, just open a chat and we'll walk through it together.

${chatUrl}/chat/

– Pidgerton`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
        <p style="font-size: 1rem; color: #333;">Hey ${name},</p>
        <p style="font-size: 1rem; color: #333;">Your weekly relationship check-in is ready. This week's focus areas:</p>
        <ul style="color: #555; font-size: 0.95rem;">
          ${dimensions.map(d => `<li>${d}</li>`).join('')}
        </ul>
        <p style="font-size: 1rem; color: #333;">When you're ready, just open a chat and we'll walk through it together.</p>
        <a href="${chatUrl}/chat/" style="display: inline-block; padding: 0.75rem 1.5rem; background: #7c3aed; color: white; text-decoration: none; border-radius: 24px; font-weight: 600; margin-top: 1rem;">Start Check-in</a>
        <p style="font-size: 0.85rem; color: #999; margin-top: 2rem;">– Pidgerton</p>
      </div>
    `
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

module.exports = { sendSurveyNotification };
